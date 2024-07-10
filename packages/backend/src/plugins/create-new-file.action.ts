/**
 * This action is created to add the `env.sh` file to the `telemed-app-ui` template. As the command in it contains `${%s}` and backstage looks at it as variable to replace before scaffolding and throws error. To avoid this edge case this action places the file after the skeleton parsing is done.
 * TODO: Find an alternate to handle such cases in future without an extra action.  // NOSONAR
 */
import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { writeFile } from 'fs';

export const createNewFileAction = () => {
  return createTemplateAction<{ contents: string; filename: string }>({
    id: 'acme:file:create',
    async handler(ctx) {
      const { signal } = ctx;
      console.log('Workspace path: ', ctx.workspacePath);  // NOSONAR
      await writeFile(
        `${ctx.workspacePath}/env.sh` ,
        `#!/bin/bash

        envsubst "$(printf '\${%s} ' $(env | cut -d'=' -f1))" < config.template.json > config.json
        `,
        { signal },
        _ => {},
      );
    },
  });
};
