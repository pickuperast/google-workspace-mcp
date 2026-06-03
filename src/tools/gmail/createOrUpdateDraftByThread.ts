import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { getGmailClient } from '../../clients.js';
import { buildRawMessage } from './helpers.js';
import { CreateOrUpdateDraftByThreadParameters } from './schemas.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'createOrUpdateDraftByThread',
    description:
      'Finds an existing draft in a Gmail thread and replaces it; if none exists, creates a new draft in that thread.',
    parameters: CreateOrUpdateDraftByThreadParameters,
    execute: async (args, { log }) => {
      const gmail = await getGmailClient();
      const threadId = args.threadId;
      if (!threadId) {
        throw new UserError('threadId is required for createOrUpdateDraftByThread.');
      }
      log.info(`Creating or updating draft in thread ${threadId}`);

      try {
        const thread = await gmail.users.threads.get({
          userId: 'me',
          id: threadId,
          format: 'minimal',
        });

        const existingDraftMessage = thread.data.messages?.find((message) =>
          (message.labelIds ?? []).includes('DRAFT')
        );

        if (existingDraftMessage?.id) {
          const drafts = await gmail.users.drafts.list({ userId: 'me' });
          const existingDraft = drafts.data.drafts?.find(
            (draft) => draft.message?.id === existingDraftMessage.id
          );

          if (existingDraft?.id) {
            const updated = await gmail.users.drafts.update({
              userId: 'me',
              id: existingDraft.id,
              requestBody: {
                id: existingDraft.id,
                message: {
                  raw: buildRawMessage(args),
                  threadId,
                },
              },
            });

            return JSON.stringify(
              {
                action: 'updated',
                draft: {
                  id: updated.data.id ?? null,
                  messageId: updated.data.message?.id ?? null,
                  threadId: updated.data.message?.threadId ?? null,
                },
              },
              null,
              2
            );
          }
        }

        const created = await gmail.users.drafts.create({
          userId: 'me',
          requestBody: {
            message: {
              raw: buildRawMessage(args),
              threadId,
            },
          },
        });

        return JSON.stringify(
          {
            action: 'created',
            draft: {
              id: created.data.id ?? null,
              messageId: created.data.message?.id ?? null,
              threadId: created.data.message?.threadId ?? null,
            },
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error upserting draft in thread ${args.threadId}: ${error.message || error}`);
        throw new UserError(
          `Failed to create or update draft by thread: ${error.message || 'Unknown error'}`
        );
      }
    },
  });
}
