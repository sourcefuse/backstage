const utils = require('./utils');
module.exports = async function microservice(
  prefix,
  cwd,
  services,
  databaseType,
  sourceloop,
  facade,
) {
  const originalCwd = process.cwd();
  process.chdir(cwd);
  const env = utils.getEnv(cwd, 'microservice');
  for (let service of services) {
    if (sourceloop) {
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
    } else {
      if(facade) {
        await utils.runWithEnv(env, 'microservice', [service.name, '-y'], {
          uniquePrefix: prefix,
          facade: true,
          config: JSON.stringify({
            applicationName: service.name,
            description: `Sourceloop based ${service.name}`,
          }),
        });
      } else {
        await utils.runWithEnv(env, 'microservice', [service.name, '-y'], {
          uniquePrefix: prefix,
          datasourceType: databaseType,
          datasourceName: 'db',
          facade: false,
          config: JSON.stringify({
            applicationName: service.name,
            description: `Sourceloop based ${service.name}`,
          }),
        });
      }
    }
  }
  process.chdir(originalCwd);
};
