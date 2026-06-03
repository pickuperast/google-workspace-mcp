import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getFormsClient } from '../../clients.js';
import { buildQuestionItem, formQuestionSchema, summarizeForm } from './helpers.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'addFormQuestion',
    description:
      'Adds a question to a Google Form. Supports short text, paragraph, radio, checkbox, dropdown, scale, date, and time questions.',
    parameters: z.object({
      formId: z.string().describe('The form ID from a Google Forms URL.'),
      index: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe('Zero-based item index. Defaults to appending at the end.'),
      question: formQuestionSchema,
      includeFormInResponse: z
        .boolean()
        .optional()
        .default(false)
        .describe('Return the updated form summary in addition to created IDs.'),
    }),
    execute: async (args, { log }) => {
      const forms = await getFormsClient();
      log.info(`Adding question to form ${args.formId}`);

      try {
        const index =
          args.index ?? (await forms.forms.get({ formId: args.formId })).data.items?.length ?? 0;
        const response = await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: {
            includeFormInResponse: args.includeFormInResponse,
            requests: [
              {
                createItem: {
                  item: buildQuestionItem(args.question),
                  location: { index },
                },
              },
            ],
          },
        });

        return JSON.stringify(
          {
            replies: response.data.replies,
            writeControl: response.data.writeControl,
            form: response.data.form ? summarizeForm(response.data.form) : undefined,
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error adding form question: ${error.message || error}`);
        if (error.code === 404) throw new UserError('Form not found. Check the form ID.');
        if (error.code === 403)
          throw new UserError('Permission denied. Make sure you can edit this form.');
        throw new UserError(`Failed to add form question: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
