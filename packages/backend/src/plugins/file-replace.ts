import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import fs from 'fs';
import * as path from 'path';

export const fileReplaceAction = () => {
  return createTemplateAction({
    id: 'acme:file:replace',
    description: 'Find and replace strings in a file within the workspace',
    schema: {
      input: z =>
        z.object({
          filePath: z
            .string()
            .describe('Path to the file relative to workspace root'),
          replacements: z
            .array(
              z.object({
                search: z.string().describe('String to find'),
                replace: z.string().optional().default('').describe('String to replace with (omit or empty to delete)'),
                type: z
                  .enum(['plain', 'yaml-list'])
                  .optional()
                  .describe(
                    'Replacement type: plain (default) or yaml-list (converts comma-separated values to YAML list items)',
                  ),
                indent: z
                  .number()
                  .optional()
                  .describe(
                    'Indentation spaces for yaml-list items (default: 6)',
                  ),
              }),
            )
            .describe('List of find/replace pairs'),
        }),
    },
    async handler(ctx) {
      const input = ctx.input as {
        filePath: string;
        replacements: Array<{
          search: string;
          replace?: string;
          type?: 'plain' | 'yaml-list';
          indent?: number;
        }>;
      };

      const fullPath = path.resolve(ctx.workspacePath, input.filePath);
      ctx.logger.info(`Performing replacements in: ${fullPath}`);

      let content = fs.readFileSync(fullPath, 'utf8');

      for (const { search, replace: rawReplace, type, indent } of input.replacements) {
        const replace = rawReplace ?? '';
        const before = content;

        if (type === 'yaml-list') {
          const spaces = ' '.repeat(indent ?? 6);
          const items = replace
            .split(',')
            .map(b => b.trim())
            .filter(b => b.length > 0)
            .map(b => `${spaces}- ${b}`)
            .join('\n');
          content = content.split(search).join(items);
        } else {
          content = content.split(search).join(replace);
        }

        if (content !== before) {
          ctx.logger.info(`Replaced "${search}" -> "${type === 'yaml-list' ? '(yaml-list)' : replace}"`);
        } else {
          ctx.logger.warn(`No match found for "${search}"`);
        }
      }

      fs.writeFileSync(fullPath, content, 'utf8');
      ctx.logger.info('File replacements complete');
    },
  });
};
