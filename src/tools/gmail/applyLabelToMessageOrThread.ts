import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'applyLabelToMessageOrThread',
    description:
      'Applies Gmail labels to either a specific message or an entire thread, for example after send to preserve workflow state.',
    parameters: z
      .object({
        messageId: z.string().optional().describe('Target Gmail message ID.'),
        threadId: z.string().optional().describe('Target Gmail thread ID.'),
        labelIds: z.array(z.string()).min(1).describe('Label IDs to add.'),
      })
      .refine((data) => !!data.messageId !== !!data.threadId, {
        message: 'Provide exactly one of messageId or threadId.',
        path: ['messageId'],
      }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Applying Gmail labels to ${args.messageId ? `message ${args.messageId}` : `thread ${args.threadId}`}`);

      try {
        if (args.messageId) {
          const response = await gmail.users.messages.modify({
            userId: 'me',
            id: args.messageId,
            requestBody: { addLabelIds: args.labelIds },
          });

          return JSON.stringify(
            {
              targetType: 'message',
              targetId: args.messageId,
              labelIds: response.data.labelIds ?? [],
            },
            null,
            2
          );
        }

        const response = await gmail.users.threads.modify({
          userId: 'me',
          id: args.threadId!,
          requestBody: { addLabelIds: args.labelIds },
        });

        return JSON.stringify(
          {
            targetType: 'thread',
            targetId: args.threadId,
            messages: (response.data.messages ?? []).map((message) => ({
              id: message.id ?? null,
              labelIds: message.labelIds ?? [],
            })),
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error applying Gmail labels: ${error.message || error}`);
        throw new UserError(`Failed to apply Gmail labels: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
