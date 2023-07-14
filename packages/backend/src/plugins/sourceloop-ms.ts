import { createTemplateAction } from '@backstage/plugin-scaffolder-backend';
import { container } from '../utils/container';
import { WorkerPool } from 'workerpool';
import { POOL } from '../keys';

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
          cdk: {
            title: 'cdk',
            description: 'include arc-cdk?',
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
      const name = ctx.input.project;
      const databaseType = ctx.input.datasourceType;
      const sourceloop = ctx.input.sourceloop;
      const facade = ctx.input.facade;
      const cdk = ctx.input.cdk;
      if (services) {
        const pool = container.get<WorkerPool>(POOL);
        await pool.exec(
          'microservice',
          [name,cdk, ctx.workspacePath, services, databaseType, sourceloop, facade],
          {
            on: payload => {
              ctx.logger.info(payload.message);
            },
          },
        );
        ctx.logger.info('Done generating all services.');
      }
    },
  });
}
