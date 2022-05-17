const utils = require('./utils');

module.exports = async function scaffolder(name, cwd) {
  const env = utils.getEnv(cwd, 'scaffold');
  const originalCwd = process.cwd();
  process.chdir(cwd);
  await utils.runWithEnv(env, 'scaffold', [], {
    name,
    cwd,
  });
  process.chdir(originalCwd);
};
