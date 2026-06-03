import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';
import { ensureLabel, modifyDraftLabels } from './helpers.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'markDraftAsApproved',
    description:
      'Applies a workflow approval label to a Gmail draft so downstream agents can send only explicitly approved drafts.',
    parameters: z.object({
      draftId: z.string().describe('The Gmail draft ID to approve.'),
      labelName: z
        .string()
        .optional()
        .default('MCP_APPROVED')
        .describe('Label name to use as the approval marker.'),
    }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Marking Gmail draft ${args.draftId} as approved with ${args.labelName}`);

      try {
        const label = await ensureLabel(gmail, args.labelName);
        const result = await modifyDraftLabels({
          gmail,
          draftId: args.draftId,
          addLabelIds: [label.id],
        });

        return JSON.stringify(
          {
            approved: true,
            approvalLabel: label,
            ...result,
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error approving Gmail draft ${args.draftId}: ${error.message || error}`);
        if (error instanceof UserError) throw error;
        throw new UserError(`Failed to mark draft as approved: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
