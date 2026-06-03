import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'deleteGmailDraft',
    description: 'Deletes a Gmail draft by draft ID.',
    parameters: z.object({
      draftId: z.string().describe('The Gmail draft ID to delete.'),
    }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Deleting Gmail draft ${args.draftId}`);

      try {
        await gmail.users.drafts.delete({
          userId: 'me',
          id: args.draftId,
        });

        return JSON.stringify({ deleted: true, draftId: args.draftId }, null, 2);
      } catch (error: any) {
        log.error(`Error deleting Gmail draft ${args.draftId}: ${error.message || error}`);
        if (error.code === 404) throw new UserError(`Gmail draft not found: ${args.draftId}`);
        throw new UserError(`Failed to delete Gmail draft: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
