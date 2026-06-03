import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getFormsClient } from '../../clients.js';
import { simplifyFormResponse } from './helpers.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'getFormResponse',
    description: 'Gets one submitted response from a Google Form.',
    parameters: z.object({
      formId: z.string().describe('The form ID from a Google Forms URL.'),
      responseId: z.string().describe('The response ID returned by listFormResponses.'),
      raw: z
        .boolean()
        .optional()
        .default(false)
        .describe('Return the raw Google Forms API payload.'),
    }),
    execute: async (args, { log }) => {
      const forms = await getFormsClient();
      log.info(`Getting response ${args.responseId} for form ${args.formId}`);

      try {
        const response = await forms.forms.responses.get({
          formId: args.formId,
          responseId: args.responseId,
        });
        return JSON.stringify(
          args.raw ? response.data : simplifyFormResponse(response.data),
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error getting form response: ${error.message || error}`);
        if (error.code === 404) throw new UserError('Form or response not found. Check the IDs.');
        if (error.code === 403)
          throw new UserError('Permission denied. Make sure you can view responses for this form.');
        throw new UserError(`Failed to get form response: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
