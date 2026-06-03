import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';
import { modifyDraftLabels } from './helpers.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'removeLabelsFromDraft',
    description: 'Removes Gmail labels from the message backing an existing draft.',
    parameters: z.object({
      draftId: z.string().describe('The Gmail draft ID to relabel.'),
      labelIds: z
        .array(z.string())
        .min(1)
        .describe('Label IDs to remove from the draft message.'),
    }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Removing labels from Gmail draft ${args.draftId}`);

      try {
        const result = await modifyDraftLabels({
          gmail,
          draftId: args.draftId,
          removeLabelIds: args.labelIds,
        });

        return JSON.stringify(result, null, 2);
      } catch (error: any) {
        log.error(`Error removing labels from draft ${args.draftId}: ${error.message || error}`);
        throw new UserError(
          `Failed to remove labels from draft: ${error.message || 'Unknown error'}`
        );
      }
    },
  });
}
