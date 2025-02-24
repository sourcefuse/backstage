import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { readFileSync } from 'fs';
import { writeFileSync } from 'fs';
import { rmSync } from "fs";
import { existsSync } from "fs";
import simpleGit from 'simple-git';
import * as path from 'path';

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
      //const { signal } = ctx;
      console.log('test custom action -------------------------------------------------------------->');
      console.log('ctx.input.workingDir ', ctx.input.workingDir);
      console.log('ctx.input.modules ', ctx.input.modules);
      console.log('ctx.input.envList ', ctx.input.envList);
      let workingDir: string = ctx.input.workingDir

      // TODO: remove feature branch
      await cloneRepo("https://github.com/sourcefuse/arc-mono-repo-infra-template", workingDir)

      let module_path = null
      for (const [key, value] of Object.entries(ctx.input.modules)) {
        console.log(`${key}: ${value}`);
        module_path = `${workingDir}/skeleton/terraform/${key}`
        if (value === false) {
          deleteDir(module_path)
        } else {
          processDirectories(module_path, ctx.input.envList)
        }
      }
    },
  });
};


async function cloneRepo(repoUrl: string, targetDir: string) {
  try {
    console.log(`Cloning ${repoUrl} into ${targetDir}...`);
    await git.clone(repoUrl, targetDir,['--branch', "enhancement", '--single-branch']); // TODO: remove enhancement
    console.log('Repository cloned successfully!');
  } catch (error) {
    console.error('Error cloning repository:', error);
  }
}

function deleteDir(folder: string) {
  if (existsSync(folder)) {
    rmSync(folder, { recursive: true, force: true });
    console.log(`Deleted folder: ${folder}`);
  } else {
    console.log(`Folder does not exist: ${folder}`);
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

  if (existsSync(sourceFile)) {
    let content = readFileSync(sourceFile, 'utf8');

    // Replace /env/ with the environment name
    content = content.replace(/\/env\//g, `/${env}/`);

    writeFileSync(targetFile, content, 'utf8');
    console.log(`Created: ${targetFile}`);
  }
}