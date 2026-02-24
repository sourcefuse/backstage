import { createTemplateAction } from '@backstage/plugin-scaffolder-node';

import * as utils from '../utility';
import { GITHUB_DOCKER_BUILD_ACTION } from '../constant';
import { writeFile,mkdir } from 'fs';

export function createScaffoldAction() {
  return createTemplateAction({
    id: 'run:scaffold',
    description: 'Create a monorepo scaffold',
    schema: {
      input: z => z.object({
        name: z.string().describe('Name of the project and repo'),
        issuePrefix: z.string().describe('Github prefix to be used for this project'),
        description: z.string().optional().describe('Description for the project'),
        repoUrl: z.any().optional().describe('Owner of the project'),
      }),
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
      try {
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

    } catch (e) {
      console.log("error in scaffold action -------",e);
      ctx.logger.error(`Error: ${e}`);
      process.chdir(originalCwd);
    }
      process.chdir(originalCwd);
      console.log("updated to  originalCwd-------",originalCwd);
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
