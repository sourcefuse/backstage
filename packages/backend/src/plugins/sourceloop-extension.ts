import { createTemplateAction } from '@backstage/plugin-scaffolder-node';

import * as utils from '../utility';

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
      const cwd=ctx.workspacePath;
      if (extensions) {
        const promises = extensions.map(async (extension: { name: string }) =>{

          const name=extension.name;
          const env = utils.getEnv(cwd, 'extension');
          const originalCwd = process.cwd();
          process.chdir(cwd);
          await utils.runWithEnv(env, 'extension', [name, '-y'], {
            name,
            config: JSON.stringify({
              applicationName: name,
              description: `${name} extension`,
              ...utils.buildOptions,
            }),
          });
          process.chdir(originalCwd);
        });
        await Promise.all(promises);
        ctx.logger.info('Done generating all extensions.');
      }

    },
  });
}
