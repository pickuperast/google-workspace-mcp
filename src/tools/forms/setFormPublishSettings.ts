import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getFormsClient } from '../../clients.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'setFormPublishSettings',
    description: 'Publishes/unpublishes a Google Form and controls whether it accepts responses.',
    parameters: z.object({
      formId: z.string().describe('The form ID from a Google Forms URL.'),
      isPublished: z.boolean().describe('Whether the form is published and visible to responders.'),
      isAcceptingResponses: z
        .boolean()
        .describe(
          'Whether the published form accepts responses. Must be false when isPublished is false.'
        ),
    }),
    execute: async (args, { log }) => {
      const forms = await getFormsClient();
      log.info(`Setting publish settings for form ${args.formId}`);

      try {
        if (!args.isPublished && args.isAcceptingResponses) {
          throw new UserError('isAcceptingResponses cannot be true when isPublished is false.');
        }

        const response = await forms.forms.setPublishSettings({
          formId: args.formId,
          requestBody: {
            updateMask: 'publish_state',
            publishSettings: {
              publishState: {
                isPublished: args.isPublished,
                isAcceptingResponses: args.isAcceptingResponses,
              },
            },
          },
        });

        return JSON.stringify(response.data, null, 2);
      } catch (error: any) {
        log.error(`Error setting form publish settings: ${error.message || error}`);
        if (error instanceof UserError) throw error;
        if (error.code === 404) throw new UserError('Form not found. Check the form ID.');
        if (error.code === 403)
          throw new UserError('Permission denied. Make sure you can edit this form.');
        throw new UserError(
          `Failed to set form publish settings: ${error.message || 'Unknown error'}`
        );
      }
    },
  });
}
