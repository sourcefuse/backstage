import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { container } from '../utils/container';
import { WorkerPool } from 'workerpool';
import { POOL } from '../keys';

export function createExtensionAction() {
  return createTemplateAction({
    id: 'run:extension',
    description: 'Create all the provided extension',
    schema: {
      input: {
        type: 'object',
        required: ['extensions'],
        properties: {
          extensions: {
            title: 'Extension List',
            description: 'List of the extensions to generate',
            type: 'array',
          },
        },
      },
    },
    async handler(ctx: any) {
      const extensions = ctx.input.extensions;
      if (extensions) {
        const pool = container.get<WorkerPool>(POOL);
        const promises = extensions.map((extension: { name: string }) =>
          pool.exec('extension', [extension.name, ctx.workspacePath]),
        );
        await Promise.all(promises);
        ctx.logger.info('Done generating all extensions.');
      }
    },
  });
}
