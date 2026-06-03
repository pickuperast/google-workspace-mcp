import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { getGmailClient } from '../../clients.js';
import { SendExistingDraftParameters } from './schemas.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'sendGmailDraft',
    description: 'Sends an existing Gmail draft by draft ID.',
    parameters: SendExistingDraftParameters,
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Sending Gmail draft ${args.draftId}`);

      try {
        const response = await gmail.users.drafts.send({
          userId: 'me',
          requestBody: {
            id: args.draftId,
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
        log.error(`Error sending Gmail draft ${args.draftId}: ${error.message || error}`);
        if (error.code === 404) throw new UserError(`Gmail draft not found: ${args.draftId}`);
        throw new UserError(`Failed to send Gmail draft: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
