import { gmail_v1 } from 'googleapis';

function decodeBase64Url(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function findHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
): string | null {
  const header = headers?.find((item) => item.name?.toLowerCase() === name.toLowerCase());
  return header?.value ?? null;
}

function upsertHeader(lines: string[], name: string, value?: string | null) {
  const prefix = `${name.toLowerCase()}:`;
  const index = lines.findIndex((line) => line.toLowerCase().startsWith(prefix));

  if (!value) {
    if (index >= 0) lines.splice(index, 1);
    return;
  }

  const formatted = `${name}: ${value}`;
  if (index >= 0) {
    lines[index] = formatted;
  } else {
    lines.push(formatted);
  }
}

function encodeHeaderWord(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function encodeSubject(value: string) {
  return /[^\x20-\x7E]/.test(value) ? encodeHeaderWord(value) : value;
}

function splitAddressList(value?: string | null) {
  return value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean) ?? [];
}

function collectBodies(
  part: gmail_v1.Schema$MessagePart | undefined,
  state: { textBody: string | null; htmlBody: string | null }
) {
  if (!part) return;

  if (part.mimeType === 'text/plain' && !state.textBody) {
    state.textBody = decodeBase64Url(part.body?.data);
  }

  if (part.mimeType === 'text/html' && !state.htmlBody) {
    state.htmlBody = decodeBase64Url(part.body?.data);
  }

  for (const child of part.parts ?? []) {
    collectBodies(child, state);
  }
}

function collectAttachments(
  part: gmail_v1.Schema$MessagePart | undefined,
  attachments: Array<{ filename: string; mimeType: string | null; attachmentId: string | null }>
) {
  if (!part) return;

  if (part.filename) {
    attachments.push({
      filename: part.filename,
      mimeType: part.mimeType ?? null,
      attachmentId: part.body?.attachmentId ?? null,
    });
  }

  for (const child of part.parts ?? []) {
    collectAttachments(child, attachments);
  }
}

export function summarizeMessage(message: gmail_v1.Schema$Message) {
  const headers = message.payload?.headers;
  const bodyState = { textBody: null as string | null, htmlBody: null as string | null };
  const attachments: Array<{
    filename: string;
    mimeType: string | null;
    attachmentId: string | null;
  }> = [];

  collectBodies(message.payload, bodyState);
  collectAttachments(message.payload, attachments);

  return {
    id: message.id ?? null,
    threadId: message.threadId ?? null,
    labelIds: message.labelIds ?? [],
    snippet: message.snippet ?? null,
    historyId: message.historyId ?? null,
    internalDate: message.internalDate ?? null,
    subject: findHeader(headers, 'Subject'),
    from: findHeader(headers, 'From'),
    to: findHeader(headers, 'To'),
    cc: findHeader(headers, 'Cc'),
    date: findHeader(headers, 'Date'),
    textBody: bodyState.textBody,
    htmlBody: bodyState.htmlBody,
    attachments,
  };
}

export function buildRawMessage(args: {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  inReplyTo?: string;
  references?: string[];
}) {
  const headers = [
    'MIME-Version: 1.0',
    `To: ${args.to.join(', ')}`,
    args.cc?.length ? `Cc: ${args.cc.join(', ')}` : null,
    args.bcc?.length ? `Bcc: ${args.bcc.join(', ')}` : null,
    `Subject: ${encodeSubject(args.subject)}`,
    args.inReplyTo ? `In-Reply-To: ${args.inReplyTo}` : null,
    args.references?.length ? `References: ${args.references.join(' ')}` : null,
  ].filter(Boolean);

  if (args.bodyText && args.bodyHtml) {
    const boundary = `mcp-${Date.now()}`;
    const raw = [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      args.bodyText,
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      args.bodyHtml,
      `--${boundary}--`,
      '',
    ].join('\r\n');

    return Buffer.from(raw)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  const contentType = args.bodyHtml ? 'text/html' : 'text/plain';
  const body = args.bodyHtml ?? args.bodyText ?? '';
  const raw = [
    ...headers,
    `Content-Type: ${contentType}; charset="UTF-8"`,
    'Content-Transfer-Encoding: 7bit',
    '',
    body,
    '',
  ].join('\r\n');

  return Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function getMessageHeader(message: gmail_v1.Schema$Message, name: string) {
  return findHeader(message.payload?.headers, name);
}

export function extractMessageContent(message: gmail_v1.Schema$Message) {
  const summary = summarizeMessage(message);
  return {
    to: splitAddressList(summary.to),
    cc: splitAddressList(summary.cc),
    bcc: splitAddressList(getMessageHeader(message, 'Bcc')),
    subject: summary.subject ?? '',
    bodyText: summary.textBody ?? undefined,
    bodyHtml: summary.htmlBody ?? undefined,
    threadId: summary.threadId ?? undefined,
    inReplyTo: getMessageHeader(message, 'In-Reply-To') ?? undefined,
    references: splitAddressList(
      getMessageHeader(message, 'References')?.replace(/\s+/g, ',') ?? undefined
    ),
  };
}

export function mergeDraftContent(
  current: ReturnType<typeof extractMessageContent>,
  updates: Partial<ReturnType<typeof extractMessageContent>>
) {
  return {
    to: updates.to ?? current.to,
    cc: updates.cc ?? current.cc,
    bcc: updates.bcc ?? current.bcc,
    subject: updates.subject ?? current.subject,
    bodyText: updates.bodyText ?? current.bodyText,
    bodyHtml: updates.bodyHtml ?? current.bodyHtml,
    threadId: updates.threadId ?? current.threadId,
    inReplyTo: updates.inReplyTo ?? current.inReplyTo,
    references: updates.references ?? current.references,
  };
}

export function summarizeThread(message: gmail_v1.Schema$Message) {
  const summary = summarizeMessage(message);
  return {
    id: summary.id,
    threadId: summary.threadId,
    subject: summary.subject,
    from: summary.from,
    to: summary.to,
    date: summary.date,
    snippet: summary.snippet,
    labelIds: summary.labelIds,
    isDraft: summary.labelIds.includes('DRAFT'),
    isSent: summary.labelIds.includes('SENT'),
  };
}

export function getDraftMessageId(draft: gmail_v1.Schema$Draft) {
  return draft.message?.id ?? null;
}

export async function ensureLabel(
  gmail: gmail_v1.Gmail,
  labelName: string
): Promise<{ id: string; name: string }> {
  const labels = await gmail.users.labels.list({ userId: 'me' });
  const existing = labels.data.labels?.find((item) => item.name === labelName);
  if (existing?.id && existing.name) {
    return { id: existing.id, name: existing.name };
  }

  const created = await gmail.users.labels.create({
    userId: 'me',
    requestBody: {
      name: labelName,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    },
  });

  return {
    id: created.data.id!,
    name: created.data.name!,
  };
}

export async function getDraft(gmail: gmail_v1.Gmail, draftId: string) {
  return gmail.users.drafts.get({
    userId: 'me',
    id: draftId,
    format: 'full',
  });
}

export async function modifyDraftLabels(args: {
  gmail: gmail_v1.Gmail;
  draftId: string;
  addLabelIds?: string[];
  removeLabelIds?: string[];
}) {
  const draft = await args.gmail.users.drafts.get({
    userId: 'me',
    id: args.draftId,
    format: 'minimal',
  });

  const messageId = getDraftMessageId(draft.data);
  if (!messageId) {
    throw new Error(`Draft ${args.draftId} does not have an underlying message id.`);
  }

  const response = await args.gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      addLabelIds: args.addLabelIds,
      removeLabelIds: args.removeLabelIds,
    },
  });

  return {
    draftId: args.draftId,
    messageId,
    labelIds: response.data.labelIds ?? [],
  };
}

export function updateRawSubject(rawMime: string, subject: string) {
  const lines = rawMime.split(/\r\n/);
  upsertHeader(lines, 'Subject', encodeSubject(subject));
  return lines.join('\r\n');
}
