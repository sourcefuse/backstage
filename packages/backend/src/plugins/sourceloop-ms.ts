import { createTemplateAction } from '@backstage/plugin-scaffolder-node';

import * as utils from '../utility';

export function createMicroserviceAction() {
  return createTemplateAction({
    id: 'run:microservice',
    description: 'Create all the selected microservices',
    schema: {
      input: z => z.object({
        sourceloop: z.boolean().optional().describe('Is this ms based on sourceloop?'),
        facade: z.boolean().optional().describe('Is this a facade'),
        services: z.array(z.any()).describe('List of the services to generate'),
        project: z.string().describe('Name of the repo this service would be part of'),
        datasourceType: z.string().describe('Datasource Type to initialize'),
      }),
    },
    async handler(ctx: any) {
      const services = ctx.input.services;
      const prefix = ctx.input.project;
      const databaseType = ctx.input.datasourceType;
      const sourceloop = ctx.input.sourceloop;
      const facade = ctx.input.facade;
      const cwd=ctx.workspacePath;
      if (services) {

        let originalCwd ="";
        for (const service of services) {
          // create new env for a new service
          const env = utils.getEnv(cwd, 'microservice');
          originalCwd = process.cwd();
          process.chdir(cwd);
          if (sourceloop) {
            ctx.logger.info(`Generating service based on ${service}`);
            try{
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
          } catch (e) {
            ctx.logger.error(`Error generating service based on ${service}`, e);
            ctx.logger.error(`Error: ${e}`);
            process.chdir(originalCwd);
          }
            ctx.logger.info('Done');
          } else {
            if(facade) {
              ctx.logger.info(`Generating facade: ${service}`);
              try{
              await utils.runWithEnv(env, 'microservice', [service.name, '-y'], {
                uniquePrefix: prefix,
                facade: true,
                config: JSON.stringify({
                  applicationName: service.name,
                  description: `Sourceloop based ${service.name}`,
                  ...utils.buildOptions,
                }),
              });
            } catch (e) {
              ctx.logger.error(`Error generating facade: ${service}`, e);
              ctx.logger.error(`Error: ${e}`);
              process.chdir(originalCwd);
            }
              ctx.logger.info(`Done generating facade: ${service}`);
            } else {
              ctx.logger.info(`Generating microservice: ${service.name}`);
              try{
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
            }
            catch (e) {
              ctx.logger.error(`Error generating microservice: ${service.name}`, e);
              ctx.logger.error(`Error: ${e}`);
              process.chdir(originalCwd);
            }
              ctx.logger.info(`Done generating microservice: ${service.name}`);
            }
          }
          process.chdir(originalCwd);
        }

        ctx.logger.info('Done generating all services.');
      }
    },
  });
}
