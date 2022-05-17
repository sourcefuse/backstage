const utils = require('./utils');
module.exports = async function microservice(
  prefix,
  cwd,
  services,
  databaseType,
) {
  const originalCwd = process.cwd();
  process.chdir(cwd);
  const env = utils.getEnv(cwd, 'microservice');
  for (let service of services) {
    await utils.runWithEnv(env, 'microservice', [service, '-y'], {
      uniquePrefix: prefix,
      baseService: service,
      datasourceType: databaseType,
      datasourceName: 'db',
      facade: false,
      includeMigrations: true,
      config: JSON.stringify({
        applicationName: service,
        description: `Sourceloop based ${service}`,
      }),
    });
  }
  process.chdir(originalCwd);
};
