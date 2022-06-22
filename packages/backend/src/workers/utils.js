const yeomanenv = require('yeoman-environment');

async function yeomanRun(workspace, name, args, opts) {
  const env = getEnv(workspace, name);
  await runWithEnv(env, name, args, opts);
}

function getEnv(workspace, name) {
  const env = yeomanenv.createEnv([], { cwd: workspace });
  registerGenerators(env, name);
  return env;
}

async function runWithEnv(env, name, args, opts) {
  const yeomanArgs = [`sl:${name}`, ...(args ?? [])];
  return env.run(yeomanArgs, opts);
}

async function registerGenerators(env, generator) {
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
};

module.exports = {
  yeomanRun,
  getEnv,
  runWithEnv,
  registerGenerators,
  buildOptions,
};
