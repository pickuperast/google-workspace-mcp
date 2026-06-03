import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'sendGmailDraftBatch',
    description: 'Sends multiple existing Gmail drafts and returns a per-draft success/error report.',
    parameters: z.object({
      draftIds: z.array(z.string()).min(1).describe('Draft IDs to send.'),
    }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Sending batch of ${args.draftIds.length} Gmail drafts`);

      const results = await Promise.all(
        args.draftIds.map(async (draftId) => {
          try {
            const response = await gmail.users.drafts.send({
              userId: 'me',
              requestBody: { id: draftId },
            });

            return {
              draftId,
              ok: true,
              messageId: response.data.id ?? null,
              threadId: response.data.threadId ?? null,
            };
          } catch (error: any) {
            return {
              draftId,
              ok: false,
              error: error.message || 'Unknown error',
            };
          }
        })
      );

      return JSON.stringify({ results }, null, 2);
    },
  });
}
