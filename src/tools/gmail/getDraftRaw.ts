import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';
import { getDraft, getDraftMessageId } from './helpers.js';

function decodeBase64Url(value?: string | null) {
  if (!value) return null;
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

export function register(server: FastMCP) {
  server.addTool({
    name: 'getDraftRaw',
    description:
      'Returns the raw MIME of an existing Gmail draft so you can inspect actual headers, encoding, and body serialization.',
    parameters: z.object({
      draftId: z.string().describe('The Gmail draft ID to inspect.'),
    }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Getting raw MIME for Gmail draft ${args.draftId}`);

      try {
        const draft = await getDraft(gmail, args.draftId);
        const messageId = getDraftMessageId(draft.data);
        if (!messageId) {
          throw new UserError(`Gmail draft ${args.draftId} does not have an underlying message id.`);
        }

        const message = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'raw',
        });

        return JSON.stringify(
          {
            draftId: args.draftId,
            messageId,
            threadId: draft.data.message?.threadId ?? null,
            raw: decodeBase64Url(message.data.raw),
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error getting raw MIME for draft ${args.draftId}: ${error.message || error}`);
        if (error instanceof UserError) throw error;
        throw new UserError(`Failed to get draft raw MIME: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
