import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { drive_v3, forms_v1 } from 'googleapis';
import { z } from 'zod';
import { getDriveClient, getFormsClient } from '../../clients.js';
import { buildQuestionItem, formQuestionSchema, summarizeForm } from './helpers.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'createForm',
    description:
      'Creates a new Google Form. Optionally places it in a Drive folder and adds initial questions.',
    parameters: z.object({
      title: z.string().min(1).describe('Title shown to respondents.'),
      documentTitle: z
        .string()
        .optional()
        .describe('Drive file title. Defaults to the respondent-facing title.'),
      description: z.string().optional().describe('Optional form description.'),
      unpublished: z
        .boolean()
        .optional()
        .default(false)
        .describe('Create the form unpublished so it does not accept responses yet.'),
      parentFolderId: z
        .string()
        .optional()
        .describe('Drive folder ID where the form should be moved after creation.'),
      initialQuestions: z
        .array(formQuestionSchema)
        .optional()
        .describe('Questions to append immediately after creating the form.'),
    }),
    execute: async (args, { log }) => {
      const forms = await getFormsClient();
      log.info(`Creating Google Form "${args.title}"`);

      try {
        const response = await forms.forms.create({
          unpublished: args.unpublished,
          requestBody: {
            info: {
              title: args.title,
            },
          },
        });

        const formId = response.data.formId;
        if (!formId) {
          throw new UserError('Failed to create form - no form ID returned.');
        }

        const updateRequests: forms_v1.Schema$Request[] = [];
        if (args.description !== undefined) {
          updateRequests.push({
            updateFormInfo: {
              info: { description: args.description },
              updateMask: 'description',
            },
          });
        }
        if (args.initialQuestions?.length) {
          updateRequests.push(
            ...args.initialQuestions.map((question, index) => ({
              createItem: {
                item: buildQuestionItem(question),
                location: { index },
              },
            }))
          );
        }

        if (updateRequests.length > 0) {
          await forms.forms.batchUpdate({
            formId,
            requestBody: {
              includeFormInResponse: true,
              requests: updateRequests,
            },
          });
        }

        const drive = await getDriveClient();
        if (args.documentTitle && args.documentTitle !== args.title) {
          const fileMetadata: drive_v3.Schema$File = { name: args.documentTitle };
          await drive.files.update({
            fileId: formId,
            requestBody: fileMetadata,
            fields: 'id,name',
            supportsAllDrives: true,
          });
        }

        if (args.parentFolderId) {
          const file = await drive.files.get({
            fileId: formId,
            fields: 'parents',
            supportsAllDrives: true,
          });
          await drive.files.update({
            fileId: formId,
            addParents: args.parentFolderId,
            removeParents: file.data.parents?.join(','),
            fields: 'id,parents',
            supportsAllDrives: true,
          });
        }

        const [form, file] = await Promise.all([
          forms.forms.get({ formId }),
          drive.files.get({
            fileId: formId,
            fields: 'id,name,webViewLink,parents',
            supportsAllDrives: true,
          }),
        ]);

        return JSON.stringify(
          {
            ...summarizeForm(form.data),
            url: file.data.webViewLink,
            parentFolderIds: file.data.parents || [],
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error creating form: ${error.message || error}`);
        if (error instanceof UserError) throw error;
        if (error.code === 404)
          throw new UserError('Parent folder not found. Check the folder ID.');
        if (error.code === 403)
          throw new UserError(
            'Permission denied. Enable the Google Forms API and make sure the OAuth token has Forms and Drive scopes.'
          );
        throw new UserError(`Failed to create form: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
