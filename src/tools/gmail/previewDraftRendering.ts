import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';
import { getDraft, summarizeMessage } from './helpers.js';

function extractLinks(html?: string | null) {
  if (!html) return [];
  const matches = html.match(/href\s*=\s*["']([^"']+)["']/gi) ?? [];
  return matches
    .map((match) => match.match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? null)
    .filter(Boolean);
}

export function register(server: FastMCP) {
  server.addTool({
    name: 'previewDraftRendering',
    description:
      'Returns a practical preview of a Gmail draft: subject, plain-text body, HTML body, and extracted links. This is a MIME-level preview, not Gmail pixel-perfect rendering.',
    parameters: z.object({
      draftId: z.string().describe('The Gmail draft ID to preview.'),
    }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Previewing Gmail draft ${args.draftId}`);

      try {
        const draft = await getDraft(gmail, args.draftId);
        const message = draft.data.message;
        if (!message) {
          throw new UserError(`Gmail draft ${args.draftId} does not contain a message.`);
        }

        const summary = summarizeMessage(message);
        return JSON.stringify(
          {
            draftId: args.draftId,
            subject: summary.subject,
            from: summary.from,
            to: summary.to,
            cc: summary.cc,
            textBody: summary.textBody,
            htmlBody: summary.htmlBody,
            links: extractLinks(summary.htmlBody),
            attachments: summary.attachments,
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error previewing draft ${args.draftId}: ${error.message || error}`);
        if (error instanceof UserError) throw error;
        throw new UserError(`Failed to preview draft: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
