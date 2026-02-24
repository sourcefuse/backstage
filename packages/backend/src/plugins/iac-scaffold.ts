import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import * as path from 'path';
import fs from 'fs';


//  Use 'simple-git' for cloning repo

export const modifyIaCModules = () => {
  return createTemplateAction({
    id: 'acme:iac:modify',
    description: 'Prepare IaC modules',
    schema: {
      input: z => z.object({
        workingDir: z.string().describe('List of modules selected'),
        modules: z.record(z.any()).optional(),
        envList: z.array(z.string()).optional(),
      }),
    },
    async handler(ctx) {
      const input = ctx.input as { workingDir: string; modules?: Record<string, unknown>; envList?: string[] };
      ctx.logger.info(`ctx.input.workingDir: ${input.workingDir}`);
      ctx.logger.info(`ctx.input.modules: ${JSON.stringify(input.modules)}`);
      ctx.logger.info(`ctx.input.envList: ${JSON.stringify(input.envList)}`);
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
        for (const [key, value] of Object.entries(input.modules ?? {})) {
          ctx.logger.info(`${key}: ${value}`);
          modulePath = `${workspacePath}/terraform/${key}`
          if (value === false) {
            deleteDir(modulePath)
          } else {
            processDirectories(modulePath, input.envList ?? [])
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
  return createTemplateAction({
    id: 'acme:file:delete',
    description: 'Deletes provided directory',
    schema: {
      input: z => z.object({
        directory: z.string().describe('Directory to be deleted'),
      }),
    },
    async handler(ctx) {
      const input = ctx.input as { directory: string };
      ctx.logger.info(
        `Running example template with parameters: ${input.directory}`,
      );

      deleteDir(input.directory)
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
  let hclSourceFile: string = path.join(workingDir, "backend", 'config.env.hcl');
  let hclTargetFile: string
  let tfvarsSourceFile: string = path.join(workingDir, "tfvars", 'env.tfvars');
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
