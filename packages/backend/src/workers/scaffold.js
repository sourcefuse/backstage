const utils = require('./utils');

module.exports = async function extension(
  name,
  cwd,
  issuePrefix,
  owner,
  description,
) {
  const env = utils.getEnv(cwd, 'scaffold');
  const originalCwd = process.cwd();
  process.chdir(cwd);
  await utils.runWithEnv(env, 'scaffold', [], {
    name,
    cwd,
    issuePrefix,
    owner,
    description,
    integrateWithBackstage: true,
  });
  process.chdir(originalCwd);
};
