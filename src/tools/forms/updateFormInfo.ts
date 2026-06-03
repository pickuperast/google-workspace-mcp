import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getFormsClient } from '../../clients.js';
import { summarizeForm } from './helpers.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'updateFormInfo',
    description: 'Updates a Google Form title and/or description.',
    parameters: z.object({
      formId: z.string().describe('The form ID from a Google Forms URL.'),
      title: z.string().min(1).optional().describe('New respondent-facing title.'),
      description: z.string().optional().describe('New form description.'),
    }),
    execute: async (args, { log }) => {
      const forms = await getFormsClient();
      log.info(`Updating form info for ${args.formId}`);

      try {
        const updateMask = [
          args.title !== undefined ? 'title' : undefined,
          args.description !== undefined ? 'description' : undefined,
        ].filter(Boolean) as string[];
        if (updateMask.length === 0) {
          throw new UserError('Provide title, description, or both.');
        }

        const response = await forms.forms.batchUpdate({
          formId: args.formId,
          requestBody: {
            includeFormInResponse: true,
            requests: [
              {
                updateFormInfo: {
                  info: {
                    title: args.title,
                    description: args.description,
                  },
                  updateMask: updateMask.join(','),
                },
              },
            ],
          },
        });

        return JSON.stringify(
          { form: response.data.form ? summarizeForm(response.data.form) : undefined },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error updating form info: ${error.message || error}`);
        if (error instanceof UserError) throw error;
        if (error.code === 404) throw new UserError('Form not found. Check the form ID.');
        if (error.code === 403)
          throw new UserError('Permission denied. Make sure you can edit this form.');
        throw new UserError(`Failed to update form info: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
