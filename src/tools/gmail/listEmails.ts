import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getGmailClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'listEmails',
    description:
      'Lists Gmail messages matching a search query, with basic metadata like subject, sender, labels, and snippet.',
    parameters: z.object({
      query: z
        .string()
        .optional()
        .describe(
          'Gmail search query, e.g. "from:alice newer_than:7d" or "label:inbox is:unread".'
        ),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .default(20)
        .describe('Maximum number of messages to return (1-100).'),
      labelIds: z
        .array(z.string())
        .optional()
        .describe('Optional Gmail label IDs to filter by, e.g. ["INBOX", "UNREAD"].'),
      includeSpamTrash: z
        .boolean()
        .optional()
        .default(false)
        .describe('Whether to include Spam and Trash in the search results.'),
    }),
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      log.info(`Listing Gmail messages. Query: ${args.query || 'none'}, Max: ${args.maxResults}`);

      try {
        const listResponse = await gmail.users.messages.list({
          userId: 'me',
          maxResults: args.maxResults,
          q: args.query,
          labelIds: args.labelIds,
          includeSpamTrash: args.includeSpamTrash,
        });

        const messages = await Promise.all(
          (listResponse.data.messages ?? []).map(async (message) => {
            const detail = await gmail.users.messages.get({
              userId: 'me',
              id: message.id!,
              format: 'metadata',
              metadataHeaders: ['From', 'To', 'Subject', 'Date'],
            });

            const headers = detail.data.payload?.headers ?? [];
            const getHeader = (name: string) =>
              headers.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value ?? null;

            return {
              id: detail.data.id ?? null,
              threadId: detail.data.threadId ?? null,
              labelIds: detail.data.labelIds ?? [],
              snippet: detail.data.snippet ?? null,
              internalDate: detail.data.internalDate ?? null,
              subject: getHeader('Subject'),
              from: getHeader('From'),
              to: getHeader('To'),
              date: getHeader('Date'),
            };
          })
        );

        return JSON.stringify({ messages }, null, 2);
      } catch (error: any) {
        log.error(`Error listing Gmail messages: ${error.message || error}`);
        throw new UserError(`Failed to list Gmail messages: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
