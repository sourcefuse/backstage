const utils = require('./utils');

module.exports = async function extension(name, cwd) {
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
};
