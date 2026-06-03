import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';
import { summarizeThread } from './helpers.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'getGmailThread',
    description:
      'Gets a Gmail thread with message state summary, including which messages are drafts and which have already been sent.',
    parameters: z.object({
      threadId: z.string().describe('The Gmail thread ID.'),
    }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Getting Gmail thread ${args.threadId}`);

      try {
        const response = await gmail.users.threads.get({
          userId: 'me',
          id: args.threadId,
          format: 'full',
        });

        const messages = (response.data.messages ?? []).map(summarizeThread);
        return JSON.stringify(
          {
            threadId: args.threadId,
            messages,
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error getting Gmail thread ${args.threadId}: ${error.message || error}`);
        if (error.code === 404) throw new UserError(`Gmail thread not found: ${args.threadId}`);
        throw new UserError(`Failed to get Gmail thread: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
