import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { getGmailClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'listGmailLabels',
    description:
      'Lists Gmail labels for the authenticated account, including system and user-created labels.',
    execute: async (_args, { log }) => {
      const gmail = await getGmailClient();
      log.info('Listing Gmail labels');

      try {
        const response = await gmail.users.labels.list({ userId: 'me' });
        const labels = (response.data.labels ?? []).map((label) => ({
          id: label.id ?? null,
          name: label.name ?? null,
          type: label.type ?? null,
          messagesTotal: label.messagesTotal ?? null,
          messagesUnread: label.messagesUnread ?? null,
          threadsTotal: label.threadsTotal ?? null,
          threadsUnread: label.threadsUnread ?? null,
        }));

        return JSON.stringify({ labels }, null, 2);
      } catch (error: any) {
        log.error(`Error listing Gmail labels: ${error.message || error}`);
        throw new UserError(`Failed to list Gmail labels: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
