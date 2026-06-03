import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { getGmailClient } from '../../clients.js';
import { buildRawMessage, extractMessageContent, getDraft, mergeDraftContent } from './helpers.js';
import { PartialDraftUpdateParameters } from './schemas.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'updateGmailDraft',
    description:
      'Updates only the provided fields of an existing Gmail draft by draft ID. Internally Gmail replaces the full draft, but this tool preserves unspecified fields automatically.',
    parameters: PartialDraftUpdateParameters,
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Updating Gmail draft ${args.draftId}`);

      try {
        const currentDraft = await getDraft(gmail, args.draftId);
        const currentMessage = currentDraft.data.message;
        if (!currentMessage) {
          throw new UserError(`Gmail draft ${args.draftId} does not contain a message.`);
        }

        const merged = mergeDraftContent(extractMessageContent(currentMessage), args);
        const response = await gmail.users.drafts.update({
          userId: 'me',
          id: args.draftId,
          requestBody: {
            id: args.draftId,
            message: {
              raw: buildRawMessage(merged),
              threadId: merged.threadId,
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
        log.error(`Error updating Gmail draft ${args.draftId}: ${error.message || error}`);
        if (error instanceof UserError) throw error;
        if (error.code === 404) throw new UserError(`Gmail draft not found: ${args.draftId}`);
        throw new UserError(`Failed to update Gmail draft: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
