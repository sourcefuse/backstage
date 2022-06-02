const utils = require('./utils');

module.exports = async function extension(name, cwd, issuePrefix) {
  const env = utils.getEnv(cwd, 'scaffold');
  const originalCwd = process.cwd();
  process.chdir(cwd);
  await utils.runWithEnv(env, 'scaffold', [], {
    name,
    cwd,
    issuePrefix
  });
  process.chdir(originalCwd);
};
