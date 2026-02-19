import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import * as path from 'path';
import fs from 'fs';


//  Use 'simple-git' for cloning repo

export const modifyIaCModules = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (createTemplateAction as any)({
    id: 'acme:iac:modify',
    description: 'Prepare IaC modules',
    schema: {
      input: {
        required: ['workingDir', 'modules'],
        type: 'object',
        properties: {
          workingDir: {
            type: 'string',
            title: 'workingDir',
            description: 'List of modules selected',
          }
        },
      },
    },
    async handler(ctx: any) { // NOSONAR
      ctx.logger.info(`ctx.input.workingDir: ${ctx.input.workingDir}`);
      ctx.logger.info(`ctx.input.modules: ${JSON.stringify(ctx.input.modules)}`);
      ctx.logger.info(`ctx.input.envList: ${JSON.stringify(ctx.input.envList)}`);
      const originalCwd = process.cwd();
      ctx.logger.info(`originalCwd: ${originalCwd}`);

      const workspacePath = ctx.workspacePath;
      console.info("workspacePath -------", workspacePath);
      process.chdir(workspacePath);
      const pathChar = '.';
      const files = fs.readdirSync(pathChar);

      console.info('Files and directories:', files);

      let modulePath = null


      try {
        for (const [key, value] of Object.entries(ctx.input.modules)) {
          ctx.logger.info(`${key}: ${value}`);
          modulePath = `${workspacePath}/terraform/${key}`
          if (value === false) {
            deleteDir(modulePath)
          } else {
            processDirectories(modulePath, ctx.input.envList)
          }
        }
      } catch (error) {
        ctx.logger.error(`Error processing modules: ${error}`);
        // Optionally: rethrow or handle error here
      } finally {
        ctx.logger.info('Module processing complete.');
        process.chdir(originalCwd);
      }
    },
  });
};


export function deleteDirectory() {
  // For more information on how to define custom actions, see
  //   https://backstage.io/docs/features/software-templates/writing-custom-actions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (createTemplateAction as any)({
    id: 'acme:file:delete',
    description: 'Deletes provided directory',
    schema: {
      input: {
        type: 'object',
        required: ['directory'],
        properties: {
          deleteDirectory: {
            title: 'directory to be deleted',
            description: "Directory to be deleted",
            type: 'string',
          },
        },
      },
    },
    async handler(ctx: any) { // NOSONAR
      ctx.logger.info(
        `Running example template with parameters: ${ctx.input.directory}`,
      );

      deleteDir(ctx.input.directory)
    },
  });
}

function deleteDir(folder: string) {
  if (fs.existsSync(folder)) {
    fs.rmSync(folder, { recursive: true, force: true });
    console.info(`Deleted folder: ${folder}`);
  } else {
    console.info(`Folder does not exist: ${folder}`);
  }
}

function processDirectories(workingDir: string, envList: string[]) {
  const hclSourceFile: string = path.join(workingDir, "backend", 'config.env.hcl');
  let hclTargetFile: string
  const tfvarsSourceFile: string = path.join(workingDir, "tfvars", 'env.tfvars');
  let tfvarsTargetFile: string

  envList.forEach(env => {
    hclTargetFile = path.join(workingDir, "backend", `config.${env}.hcl`);
    tfvarsTargetFile = path.join(workingDir, "tfvars", `${env}.tfvars`);

    processFiles(hclSourceFile, hclTargetFile, env)
    processFiles(tfvarsSourceFile, tfvarsTargetFile, env)
  });

  // Delete template file
  deleteDir(hclSourceFile)
  deleteDir(tfvarsSourceFile)
}

function processFiles(sourceFile: string, targetFile: string, env: string) {

  if (fs.existsSync(sourceFile)) {
    let content = fs.readFileSync(sourceFile, 'utf8');

    // Replace /env/ with the environment name
    content = content.replace(/\/env\//g, `${env}`);

    fs.writeFileSync(targetFile, content, 'utf8');
    console.info(`Created: ${targetFile}`);
  }
}
