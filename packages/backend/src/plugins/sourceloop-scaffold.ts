import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { container } from '../utils/container';
import { WorkerPool } from 'workerpool';
import { POOL } from '../keys';

export function createScaffoldAction() {
  return createTemplateAction({
    id: 'run:scaffold',
    description: 'Create a monorepo scaffold',
    schema: {
      input: {
        type: 'object',
        required: ['name', 'issuePrefix'],
        properties: {
          name: {
            title: 'Scaffold Name',
            description: 'Name of the project and repo',
            type: 'string',
          },
          issuePrefix: {
            title: 'Issue prefix for this project',
            description: 'Github prefix to be used for this project',
            type: 'string',
          },
          description: {
            title: 'Description',
            description: 'Description for the project',
            type: 'string',
          },
          repoUrl: {
            title: 'Owner',
            description: 'Owner of the project',
          },
        },
      },
    },
    async handler(ctx: any) {
      ctx.logger.info(`Templating using Yeoman generator: ${ctx.input.name}`);
      const pool = container.get<WorkerPool>(POOL);

      await pool.exec('scaffold', [
        ctx.input.name,
        ctx.workspacePath,
        ctx.input.issuePrefix,
        ctx.input.repoUrl.owner,
        ctx.input.description,
      ]);
    },
  });
}
