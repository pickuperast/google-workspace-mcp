import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getFormsClient } from '../../clients.js';
import { simplifyFormResponse } from './helpers.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'listFormResponses',
    description: 'Lists submitted responses for a Google Form.',
    parameters: z.object({
      formId: z.string().describe('The form ID from a Google Forms URL.'),
      pageSize: z.number().int().min(1).max(5000).optional().default(100),
      pageToken: z.string().optional().describe('Next page token from a previous response.'),
      submittedAfter: z
        .string()
        .optional()
        .describe('Only responses submitted after this timestamp/date. Converted to RFC3339 UTC.'),
      submittedAtOrAfter: z
        .string()
        .optional()
        .describe(
          'Only responses submitted at or after this timestamp/date. Converted to RFC3339 UTC.'
        ),
    }),
    execute: async (args, { log }) => {
      const forms = await getFormsClient();
      log.info(`Listing responses for form ${args.formId}`);

      try {
        if (args.submittedAfter && args.submittedAtOrAfter) {
          throw new UserError('Use only one of submittedAfter or submittedAtOrAfter.');
        }
        const filter = args.submittedAfter
          ? `timestamp > ${new Date(args.submittedAfter).toISOString()}`
          : args.submittedAtOrAfter
            ? `timestamp >= ${new Date(args.submittedAtOrAfter).toISOString()}`
            : undefined;

        const response = await forms.forms.responses.list({
          formId: args.formId,
          pageSize: args.pageSize,
          pageToken: args.pageToken,
          filter,
        });

        return JSON.stringify(
          {
            nextPageToken: response.data.nextPageToken,
            responses: (response.data.responses || []).map(simplifyFormResponse),
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error listing form responses: ${error.message || error}`);
        if (error instanceof UserError) throw error;
        if (error.code === 404) throw new UserError('Form not found. Check the form ID.');
        if (error.code === 403)
          throw new UserError('Permission denied. Make sure you can view responses for this form.');
        throw new UserError(`Failed to list form responses: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
