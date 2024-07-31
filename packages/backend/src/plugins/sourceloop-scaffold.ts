import { createTemplateAction } from '@backstage/plugin-scaffolder-node';

import * as utils from '../utility';
import { GITHUB_DOCKER_BUILD_ACTION } from '../constant';
import { writeFile,mkdir } from 'fs';

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
    async handler(ctx: any) { // NOSONAR
      const { signal } = ctx;
      ctx.logger.info(`Templating using Yeoman generator: ${ctx.input.name}`);

      const name= ctx.input.name;
      const cwd=ctx.workspacePath;

      const issuePrefix=ctx.input.issuePrefix;
      const owner=ctx.input.repoUrl.owner;
      const description=ctx.input.description;
      const env = utils.getEnv(cwd, 'scaffold');
      const originalCwd = process.cwd();
      console.log("originalCwd -------",originalCwd);
      process.chdir(cwd);
      console.log("new workspacepath cwd -------",cwd);
      await utils.runWithEnv(env, 'scaffold', [], {
        name,
        cwd,
        issuePrefix,
        owner,
        description,
        integrateWithBackstage: true,
      });
      process.chdir(originalCwd);
      console.log("again updated to  originalCwd-------",originalCwd);
      await mkdir(`${ctx.workspacePath}/.github/workflows`,()=>{});
      await writeFile(
        `${ctx.workspacePath}/.github/workflows/build-image.yaml`,
        GITHUB_DOCKER_BUILD_ACTION,
        { signal },
        _ => {},
      );
    },
  });
}
