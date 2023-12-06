// import yeomanenv from 'yeoman-environment';
const yeomanenv = require('yeoman-environment');


async function yeomanRun(workspace: string, name: string, args: string[] | undefined, opts: any) {
  const env = getEnv(workspace, name);
  await runWithEnv(env, name, args, opts);
}

function getEnv(workspace: string, name: string) {
  const env = yeomanenv.createEnv([], { cwd: workspace });
  registerGenerators(env, name);
  return env;
}

async function runWithEnv(env: any, name: string, args: string[] | undefined, opts: any) {
  const yeomanArgs = [`sl:${name}`, ...(args ?? [])];
  return env.run(yeomanArgs, opts);
}

async function registerGenerators(env: any, generator: string) {
  env.register(
    require.resolve(`@sourceloop/cli/lib/generators/${generator}/index`),
    `sl:${generator}`,
  );
}

const buildOptions = {
  loopbackBuild: true,
  eslint: true,
  prettier: true,
  mocha: true,
  vscode: true,
  docker: true,
  repositories: true,
  services: true,
};

export {
  yeomanRun,
  getEnv,
  runWithEnv,
  registerGenerators,
  buildOptions,
};
