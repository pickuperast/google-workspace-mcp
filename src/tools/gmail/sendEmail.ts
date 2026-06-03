import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { getGmailClient } from '../../clients.js';
import { buildRawMessage } from './helpers.js';
import { DraftMessageParameters } from './schemas.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'sendEmail',
    description:
      'Sends a Gmail message with plain-text or HTML content, optionally inside an existing thread.',
    parameters: DraftMessageParameters,
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Sending Gmail message to ${args.to.join(', ')}`);

      try {
        const response = await gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: buildRawMessage(args),
            threadId: args.threadId,
          },
        });

        return JSON.stringify(
          {
            message: {
              id: response.data.id ?? null,
              threadId: response.data.threadId ?? null,
              labelIds: response.data.labelIds ?? [],
            },
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error sending Gmail message: ${error.message || error}`);
        throw new UserError(`Failed to send Gmail message: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
