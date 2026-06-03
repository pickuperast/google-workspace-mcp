import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { getGmailClient } from '../../clients.js';
import { buildRawMessage } from './helpers.js';
import { DraftMessageParameters } from './schemas.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'createGmailDraft',
    description:
      'Creates a Gmail draft message with plain-text or HTML content, optionally in an existing thread.',
    parameters: DraftMessageParameters,
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Creating Gmail draft for ${args.to.join(', ')}`);

      try {
        const response = await gmail.users.drafts.create({
          userId: 'me',
          requestBody: {
            message: {
              raw: buildRawMessage(args),
              threadId: args.threadId,
            },
          },
        });

        return JSON.stringify(
          {
            draft: {
              id: response.data.id ?? null,
              messageId: response.data.message?.id ?? null,
              threadId: response.data.message?.threadId ?? null,
            },
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error creating Gmail draft: ${error.message || error}`);
        throw new UserError(`Failed to create Gmail draft: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
