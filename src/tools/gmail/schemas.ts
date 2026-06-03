import { z } from 'zod';

const DraftMessageParametersBase = z.object({
  to: z.array(z.string().email()).min(1).describe('Recipient email addresses.'),
  cc: z.array(z.string().email()).optional().describe('CC email addresses.'),
  bcc: z.array(z.string().email()).optional().describe('BCC email addresses.'),
  subject: z.string().min(1).describe('Email subject line.'),
  bodyText: z.string().optional().describe('Plain-text email body.'),
  bodyHtml: z.string().optional().describe('HTML email body.'),
  threadId: z
    .string()
    .optional()
    .describe('Optional Gmail thread ID to add the message to an existing conversation.'),
  inReplyTo: z
    .string()
    .optional()
    .describe('Optional Message-ID header for replying to an existing email.'),
  references: z
    .array(z.string())
    .optional()
    .describe('Optional References header values for threading email replies.'),
});

function requireBody<T extends { bodyText?: string; bodyHtml?: string }>(schema: z.ZodType<T>) {
  return schema.refine((data) => data.bodyText || data.bodyHtml, {
    message: 'At least one of bodyText or bodyHtml must be provided.',
    path: ['bodyText'],
  });
}

export const DraftMessageParameters = requireBody(DraftMessageParametersBase);

export const UpdateDraftParameters = requireBody(DraftMessageParametersBase.extend({
  draftId: z.string().describe('The Gmail draft ID to replace.'),
}));

export const PartialDraftUpdateParameters = z
  .object({
    draftId: z.string().describe('The Gmail draft ID to update.'),
    to: z.array(z.string().email()).optional().describe('Recipient email addresses.'),
    cc: z.array(z.string().email()).optional().describe('CC email addresses.'),
    bcc: z.array(z.string().email()).optional().describe('BCC email addresses.'),
    subject: z.string().optional().describe('Email subject line.'),
    bodyText: z.string().optional().describe('Plain-text email body.'),
    bodyHtml: z.string().optional().describe('HTML email body.'),
    threadId: z
      .string()
      .optional()
      .describe('Optional Gmail thread ID to keep the draft in an existing conversation.'),
    inReplyTo: z
      .string()
      .optional()
      .describe('Optional Message-ID header for replying to an existing email.'),
    references: z
      .array(z.string())
      .optional()
      .describe('Optional References header values for threading email replies.'),
  })
  .refine((data) => {
    const keys = Object.keys(data).filter((key) => key !== 'draftId');
    return keys.length > 0;
  }, {
    message: 'At least one field besides draftId must be provided.',
    path: ['draftId'],
  });

export const SendExistingDraftParameters = z.object({
  draftId: z.string().describe('The Gmail draft ID to send.'),
});

export const CreateOrUpdateDraftByThreadParameters = requireBody(
  DraftMessageParametersBase.extend({
    threadId: z.string().describe('The Gmail thread ID to search for an existing draft in.'),
  })
);
