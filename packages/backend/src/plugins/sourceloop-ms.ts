import { createTemplateAction } from '@backstage/plugin-scaffolder-node';

const utils=require('../utility');

export function createMicroserviceAction() {
  return createTemplateAction({
    id: 'run:microservice',
    description: 'Create all the selected microservices',
    schema: {
      input: {
        type: 'object',
        required: [
          'services',
          'project',
          'datasourceType',
          'sourceloop',
          'facade',
        ],
        properties: {
          sourceloop: {
            title: 'Sourceloop-based',
            description: 'Is this ms based on sourceloop?',
            type: 'boolean',
          },
          facade: {
            title: 'isFacade',
            description: 'Is this a facade',
            type: 'boolean',
          },
          services: {
            title: 'Services List',
            description: 'List of the services to generate',
            type: 'array',
          },
          project: {
            title: 'Project Name',
            description: 'Name of the repo this service would be part of',
            type: 'string',
          },
          datasourceType: {
            title: 'Datasource Type',
            description: 'Datasource Type to initialize',
            type: ['postgres', 'mysql'],
          },
        },
      },
    },
    async handler(ctx: any) {
      const services = ctx.input.services;
      const prefix = ctx.input.project;
      const databaseType = ctx.input.datasourceType;
      const sourceloop = ctx.input.sourceloop;
      const facade = ctx.input.facade;
      const cwd=ctx.workspacePath;
      if (services) {

        const env = utils.getEnv(cwd, 'microservice');
        const originalCwd = process.cwd();
        process.chdir(cwd);
        for (const service of services) {
          if (sourceloop) {
            ctx.logger.info(`Generating service based on ${service}`);
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
            ctx.logger.info('Done');
          } else {
            if(facade) {
              ctx.logger.info(`Generating facade: ${service}`);
              await utils.runWithEnv(env, 'microservice', [service.name, '-y'], {
                uniquePrefix: prefix,
                facade: true,
                config: JSON.stringify({
                  applicationName: service.name,
                  description: `Sourceloop based ${service.name}`,
                  ...utils.buildOptions,
                }),
              });
              ctx.logger.info(`Done generating facade: ${service}`);
            } else {
              ctx.logger.info(`Generating microservice: ${service.name}`);
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
              ctx.logger.info(`Done generating microservice: ${service.name}`);
            }
          }
        }
        process.chdir(originalCwd);
        ctx.logger.info('Done generating all services.');
      }
    },
  });
}
