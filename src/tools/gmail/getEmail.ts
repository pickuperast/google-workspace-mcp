import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';
import { summarizeMessage } from './helpers.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'getEmail',
    description:
      'Gets a Gmail message by ID, including headers, labels, snippet, plain-text body, HTML body, and attachment metadata.',
    parameters: z.object({
      messageId: z.string().describe('The Gmail message ID.'),
    }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Getting Gmail message ${args.messageId}`);

      try {
        const response = await gmail.users.messages.get({
          userId: 'me',
          id: args.messageId,
          format: 'full',
        });

        return JSON.stringify({ message: summarizeMessage(response.data) }, null, 2);
      } catch (error: any) {
        log.error(`Error getting Gmail message ${args.messageId}: ${error.message || error}`);
        if (error.code === 404) throw new UserError(`Gmail message not found: ${args.messageId}`);
        throw new UserError(`Failed to get Gmail message: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
