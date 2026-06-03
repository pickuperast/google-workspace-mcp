import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';
import { modifyDraftLabels } from './helpers.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'applyLabelsToDraft',
    description: 'Applies Gmail labels to the message backing an existing draft.',
    parameters: z.object({
      draftId: z.string().describe('The Gmail draft ID to label.'),
      labelIds: z.array(z.string()).min(1).describe('Label IDs to add to the draft message.'),
    }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Applying labels to Gmail draft ${args.draftId}`);

      try {
        const result = await modifyDraftLabels({
          gmail,
          draftId: args.draftId,
          addLabelIds: args.labelIds,
        });

        return JSON.stringify(result, null, 2);
      } catch (error: any) {
        log.error(`Error applying labels to draft ${args.draftId}: ${error.message || error}`);
        throw new UserError(`Failed to apply labels to draft: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
