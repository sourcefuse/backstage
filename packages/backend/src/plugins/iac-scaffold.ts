import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import simpleGit from 'simple-git';
import * as path from 'path';
import fs from 'fs';

const git = simpleGit();

export const modifyIaCModules = () => {
  return createTemplateAction<{ workingDir: string, modules: object , envList:string[]}>({
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
    async handler(ctx) {
      console.info('ctx.input.workingDir ', ctx.input.workingDir);
      console.info('ctx.input.modules ', ctx.input.modules);
      console.info('ctx.input.envList ', ctx.input.envList);
      let workingDir: string = ctx.input.workingDir
      
      await cloneRepo("https://github.com/sourcefuse/arc-mono-repo-infra-template", workingDir)

      let modulePath = null
      for (const [key, value] of Object.entries(ctx.input.modules)) {
        console.info(`${key}: ${value}`);
        modulePath = `${workingDir}/skeleton/terraform/${key}`
        if (value === false) {
          deleteDir(modulePath)
        } else {
          processDirectories(modulePath, ctx.input.envList)
        }
      }
    },
  });
};


export function deleteDirectory() {
  // For more information on how to define custom actions, see
  //   https://backstage.io/docs/features/software-templates/writing-custom-actions
  return createTemplateAction<{
    directory: string;
  }>({
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
    async handler(ctx) {
      ctx.logger.info(
        `Running example template with parameters: ${ctx.input.directory}`,
      );

      deleteDir(ctx.input.directory)
    },
  });
}


async function cloneRepo(repoUrl: string, targetDir: string) {
  try {
    console.info(`Cloning ${repoUrl} into ${targetDir}...`);
    await git.clone(repoUrl, targetDir); 
    console.info('Repository cloned successfully!');
  } catch (error) {
    console.error('Error cloning repository:', error);
  }
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
    content = content.replace(/\/env\//g, `/${env}/`);

    fs.writeFileSync(targetFile, content, 'utf8');
    console.info(`Created: ${targetFile}`);
  }
}