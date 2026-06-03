import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getFormsClient } from '../../clients.js';
import { summarizeForm } from './helpers.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'getForm',
    description: 'Gets Google Form metadata, settings, publish state, and questions.',
    parameters: z.object({
      formId: z.string().describe('The form ID from a Google Forms URL.'),
      raw: z
        .boolean()
        .optional()
        .default(false)
        .describe('Return the raw Google Forms API payload.'),
    }),
    execute: async (args, { log }) => {
      const forms = await getFormsClient();
      log.info(`Getting form ${args.formId}`);

      try {
        const response = await forms.forms.get({ formId: args.formId });
        return JSON.stringify(args.raw ? response.data : summarizeForm(response.data), null, 2);
      } catch (error: any) {
        log.error(`Error getting form ${args.formId}: ${error.message || error}`);
        if (error.code === 404) throw new UserError('Form not found. Check the form ID.');
        if (error.code === 403)
          throw new UserError('Permission denied. Make sure you have access to this form.');
        throw new UserError(`Failed to get form: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
