const utils = require('./utils');
const workerpool = require('workerpool');
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
      workerpool.workerEmit({
        message: `Generating service based on ${service}`
      });
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
          ...utils.buildOptions,
        }),
      });
      workerpool.workerEmit({
        message: `Done.`
      });
    } else {
      if(facade) {
        workerpool.workerEmit({
          message: `Generating facade: ${service}`
        });
        await utils.runWithEnv(env, 'microservice', [service.name, '-y'], {
          uniquePrefix: prefix,
          facade: true,
          config: JSON.stringify({
            applicationName: service.name,
            description: `Sourceloop based ${service.name}`,
            ...utils.buildOptions,
          }),
        });
        workerpool.workerEmit({
          message: `Done generating facade: ${service}`
        });
      } else {
        workerpool.workerEmit({
          message: `Generating microservice: ${service.name}`
        });
        await utils.runWithEnv(env, 'microservice', [service.name, '-y'], {
          uniquePrefix: prefix,
          datasourceType: databaseType,
          datasourceName: 'db',
          facade: false,
          config: JSON.stringify({
            applicationName: service.name,
            description: `Sourceloop based ${service.name}`,
            ...utils.buildOptions,
          }),
        });
        workerpool.workerEmit({
          message: `Done generating microservice: ${service.name}`
        });
      }
    }
  }
  process.chdir(originalCwd);
};
