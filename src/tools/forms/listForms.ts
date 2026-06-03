import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getDriveClient } from '../../clients.js';

function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function register(server: FastMCP) {
  server.addTool({
    name: 'listForms',
    description: 'Lists Google Forms in Drive, optionally filtered by name and modified date.',
    parameters: z.object({
      maxResults: z.number().int().min(1).max(100).optional().default(20),
      query: z.string().optional().describe('Filter forms by name.'),
      orderBy: z.enum(['name', 'modifiedTime', 'createdTime']).optional().default('modifiedTime'),
      modifiedAfter: z
        .string()
        .optional()
        .describe('Only return forms modified after this date (ISO 8601 format).'),
      parentFolderId: z.string().optional().describe('Only return forms in this Drive folder.'),
    }),
    execute: async (args, { log }) => {
      const drive = await getDriveClient();
      log.info(`Listing Google Forms. Query: ${args.query || 'none'}, Max: ${args.maxResults}`);

      try {
        let queryString = "mimeType='application/vnd.google-apps.form' and trashed=false";
        if (args.query) queryString += ` and name contains '${escapeDriveQuery(args.query)}'`;
        if (args.parentFolderId)
          queryString += ` and '${escapeDriveQuery(args.parentFolderId)}' in parents`;
        if (args.modifiedAfter)
          queryString += ` and modifiedTime > '${new Date(args.modifiedAfter).toISOString()}'`;

        const response = await drive.files.list({
          q: queryString,
          pageSize: args.maxResults,
          orderBy: args.orderBy,
          fields:
            'files(id,name,modifiedTime,createdTime,webViewLink,parents,owners(displayName,emailAddress))',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });

        return JSON.stringify(
          {
            forms: (response.data.files || []).map((file) => ({
              id: file.id,
              name: file.name,
              modifiedTime: file.modifiedTime,
              createdTime: file.createdTime,
              owner: file.owners?.[0]?.displayName || null,
              url: file.webViewLink,
              parentFolderIds: file.parents || [],
            })),
          },
          null,
          2
        );
      } catch (error: any) {
        log.error(`Error listing Google Forms: ${error.message || error}`);
        if (error.code === 403)
          throw new UserError('Permission denied. Make sure you have granted Google Drive access.');
        throw new UserError(`Failed to list forms: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
