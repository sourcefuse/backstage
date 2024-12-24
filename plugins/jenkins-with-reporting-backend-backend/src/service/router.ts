import { MiddlewareFactory } from '@backstage/backend-defaults/rootHttpRouter';
import express from 'express';
import Router from 'express-promise-router';
import { JenkinsReportsApi } from './JenkinsReportsApi';
import { JenkinsApiImpl } from './jenkinsApi';
import { JenkinsInfoProvider } from '@backstage-community/plugin-jenkins-backend';

import { createLegacyAuthAdapters } from '@backstage/backend-common';

import {
  AuthService,
  DiscoveryService,
  HttpAuthService,
  LoggerService,
  RootConfigService,
} from '@backstage/backend-plugin-api';
import {
  PermissionAuthorizer,
  PermissionEvaluator,
} from '@backstage/plugin-permission-common';

import { CatalogClient } from '@backstage/catalog-client';

/** @public */
export interface RouterOptions {
  logger: LoggerService;
  jenkinsInfoProvider: JenkinsInfoProvider;
  permissions?: PermissionEvaluator | PermissionAuthorizer;
  discovery: DiscoveryService;
  auth?: AuthService;
  httpAuth?: HttpAuthService;
  config: RootConfigService;
  catalogClient: CatalogClient;
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { jenkinsInfoProvider, logger, config, catalogClient } = options;

  const jenkinsService = new JenkinsApiImpl();

  const api = new JenkinsReportsApi(jenkinsService);
  const { httpAuth } = createLegacyAuthAdapters(options);
  const router = Router();
  router.use(express.json());

  router.get('/health', (_, response) => {
    logger.info('PING!');
    response.json({ status: 'ok' });
  });

  router.get(
    '/reports/:namespace/:kind/:name/:jobFullName/:buildNumber',
    async (req, res) => {
      const { name, jobFullName, buildNumber } = req.params;
      try {
        const creds = (await httpAuth.credentials(req)) as any; //NOSONAR

        const entity = await catalogClient.getEntityByRef(
          `${req.params.kind}:${req.params.namespace}/${req.params.name}`,
          {
            token: creds.token,
          },
        );

        if (!entity) {
          throw new Error('Entity not found');
        }

        // Get S3 bucket name from entity annotations
        const s3bucketName =
          entity.metadata.annotations?.['jenkins.io/s3-bucket-name'] ?? '';

        // Get S3 bucket annotation
        const s3BucketRoleArn =
          entity.metadata.annotations?.['jenkins.io/s3-bucket-role-arn'] ?? '';

        const s3BucketRegion =
          entity.metadata.annotations?.['jenkins.io/s3-bucket-region'] ?? '';
        const reports = await api.fetchBuildReports(
          name,
          jobFullName,
          parseInt(buildNumber),
          s3bucketName,
          s3BucketRoleArn,
          s3BucketRegion,
        );

        res.json(reports);
      } catch (error) {
        res.status(500).json({ error: error.message }); //NOSONAR
      }
    },
  );

  router.get(
    '/v1/entity/:namespace/:kind/:name/job/:jobFullName',
    async (request, response) => {
      const { namespace, kind, name, jobFullName } = request.params;
      const jenkinsInfo = await jenkinsInfoProvider.getInstance({
        entityRef: {
          kind,
          namespace,
          name,
        },
        jobFullName,
        credentials: await httpAuth.credentials(request),
      });

      const build = await jenkinsService.getJobBuilds(jenkinsInfo, jobFullName);

      response.json({
        build,
      });
    },
  );

  router.get(
    '/v1/entity/:namespace/:kind/:name/projects',
    async (request, response) => {

      const { namespace, kind, name } = request.params;
      const branch = request.query.branch;
      let branches;
      if (branch === void 0) {
        branches = void 0;
      } else if (typeof branch === "string") {
        branches = branch.split(/,/g);
      } else {
        response.status(400).send("Something was unexpected about the branch queryString"); // NOSONAR
        return;
      }
      const jenkinsInfo = await jenkinsInfoProvider.getInstance({
        entityRef: {
          kind,
          namespace,
          name
        },
        credentials: await httpAuth.credentials(request)
      });
      try {
        const projects = await jenkinsService.getProjects(jenkinsInfo, branches);
        response.json({
          projects
        });
      } catch (err) {
        if (err.errors) {
          throw new Error(
            `Unable to fetch projects, for ${jenkinsInfo.jobFullName}: ${err.errors.stringifyError(err.errors)}`
          );
        }
        throw err;
      }
    },
  );


  const middleware = MiddlewareFactory.create({ logger, config });

  router.use(middleware.error());
  // @ts-ignore
  return router;
}
