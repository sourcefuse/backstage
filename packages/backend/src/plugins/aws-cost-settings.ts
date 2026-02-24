import {coreServices, createBackendPlugin} from '@backstage/backend-plugin-api';
import Router from 'express-promise-router';
import express from 'express';
import {
  CostExplorerClient,
  GetCostAndUsageCommand,
} from '@aws-sdk/client-cost-explorer';
import type {Granularity} from '@aws-sdk/client-cost-explorer';
import {
  ECSClient,
  DescribeClustersCommand,
  DescribeServicesCommand,
  ListTasksCommand,
  DescribeTasksCommand,
  ListServicesCommand,
} from '@aws-sdk/client-ecs';
import {
  LambdaClient,
  GetFunctionConfigurationCommand,
} from '@aws-sdk/client-lambda';
import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
  type Statistic,
  type StandardUnit,
} from '@aws-sdk/client-cloudwatch';

const TABLE = 'plugin_aws_cost_entity_settings';

function makeEcsClient(row: any) {
  const credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  } = {
    accessKeyId: row.aws_access_key_id,
    secretAccessKey: row.aws_secret_access_key,
  };
  if (row.aws_session_token?.trim()) {
    credentials.sessionToken = row.aws_session_token.trim();
  }
  return new ECSClient({
    region: row.aws_region || 'us-east-1',
    credentials,
  });
}

function makeLambdaClient(row: any) {
  const credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  } = {
    accessKeyId: row.aws_access_key_id,
    secretAccessKey: row.aws_secret_access_key,
  };
  if (row.aws_session_token?.trim()) {
    credentials.sessionToken = row.aws_session_token.trim();
  }
  return new LambdaClient({
    region: row.aws_region || 'us-east-1',
    credentials,
  });
}

function makeCloudWatchClient(row: any) {
  const credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  } = {
    accessKeyId: row.aws_access_key_id,
    secretAccessKey: row.aws_secret_access_key,
  };
  if (row.aws_session_token?.trim()) {
    credentials.sessionToken = row.aws_session_token.trim();
  }
  return new CloudWatchClient({
    region: row.aws_region || 'us-east-1',
    credentials,
  });
}

export const awsCostSettingsPlugin = createBackendPlugin({
  pluginId: 'aws-cost-settings',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        database: coreServices.database,
        logger: coreServices.logger,
      },
      async init({httpRouter, database, logger}) {
        const db = await database.getClient();

        if (!(await db.schema.hasTable(TABLE))) {
          await db.schema.createTable(TABLE, table => {
            table.increments('id').primary();
            table.string('entity_ref', 512).notNullable();
            table.string('config_name', 255).notNullable().defaultTo('Default');
            // Credentials stored server-side only, never returned to frontend
            table.text('aws_access_key_id').notNullable();
            table.text('aws_secret_access_key').notNullable();
            table.text('aws_session_token').nullable();
            table.string('aws_region', 64).notNullable().defaultTo('us-east-1');
            table.string('aws_account_id', 32).defaultTo('');
            // ECS fields
            table.string('ecs_cluster_name', 255).defaultTo('');
            table.string('ecs_service_name', 255).defaultTo('');
            // Lambda fields
            table.string('lambda_function_name', 255).defaultTo('');
            table.timestamps(true, true);
            table.unique(['entity_ref', 'config_name']);
          });
          logger.info('Created plugin_aws_cost_entity_settings table');
        } else {
          // Migrate existing table: add missing columns
          const hasSessionToken = await db.schema.hasColumn(TABLE, 'aws_session_token');
          if (!hasSessionToken) {
            await db.schema.alterTable(TABLE, t => {
              t.text('aws_session_token').nullable();
            });
            logger.info('Migrated: added aws_session_token column');
          }
          const hasEcsCluster = await db.schema.hasColumn(TABLE, 'ecs_cluster_name');
          if (!hasEcsCluster) {
            await db.schema.alterTable(TABLE, t => {
              t.string('ecs_cluster_name', 255).defaultTo('');
              t.string('ecs_service_name', 255).defaultTo('');
            });
            logger.info('Migrated: added ecs_cluster_name and ecs_service_name columns');
          }
          const hasLambdaFunction = await db.schema.hasColumn(TABLE, 'lambda_function_name');
          if (!hasLambdaFunction) {
            await db.schema.alterTable(TABLE, t => {
              t.string('lambda_function_name', 255).defaultTo('');
            });
            logger.info('Migrated: added lambda_function_name column');
          }
        }

        const router = Router();
        router.use(express.json());

        // ── Helpers ─────────────────────────────────────────────────────────────
        const safeRow = (r: any) => ({
          id: r.id,
          entity_ref: r.entity_ref,
          config_name: r.config_name,
          aws_region: r.aws_region,
          aws_account_id: r.aws_account_id,
          ecs_cluster_name: r.ecs_cluster_name ?? '',
          ecs_service_name: r.ecs_service_name ?? '',
          lambda_function_name: r.lambda_function_name ?? '',
          created_at: r.created_at,
          updated_at: r.updated_at,
          has_credentials: true,
          has_session_token: Boolean(r.aws_session_token?.trim()),
        });

        // ── CRUD ─────────────────────────────────────────────────────────────────

        // GET all configs for an entity
        router.get('/', async (req, res) => {
          const {entityRef} = req.query;
          if (!entityRef || typeof entityRef !== 'string') {
            return res.status(400).json({error: 'entityRef query param required'});
          }
          const rows = await db(TABLE)
            .where({entity_ref: entityRef})
            .orderBy('created_at', 'asc')
            .select(
              'id', 'entity_ref', 'config_name', 'aws_region', 'aws_account_id',
              'aws_session_token', 'ecs_cluster_name', 'ecs_service_name',
              'lambda_function_name', 'created_at', 'updated_at',
            );
          return res.json(rows.map(safeRow));
        });

        // POST create new config
        router.post('/', async (req, res) => {
          const {
            entityRef, configName, awsAccessKeyId, awsSecretAccessKey,
            awsSessionToken, awsRegion, awsAccountId,
            ecsClusterName, ecsServiceName, lambdaFunctionName,
          } = req.body;
          if (!entityRef || !awsAccessKeyId || !awsSecretAccessKey) {
            return res.status(400).json({
              error: 'entityRef, awsAccessKeyId and awsSecretAccessKey are required',
            });
          }
          const [row] = await db(TABLE)
            .insert({
              entity_ref: entityRef,
              config_name: configName?.trim() || 'Default',
              aws_access_key_id: awsAccessKeyId.trim(),
              aws_secret_access_key: awsSecretAccessKey.trim(),
              aws_session_token: awsSessionToken?.trim() || null,
              aws_region: awsRegion?.trim() || 'us-east-1',
              aws_account_id: awsAccountId?.trim() || '',
              ecs_cluster_name: ecsClusterName?.trim() || '',
              ecs_service_name: ecsServiceName?.trim() || '',
              lambda_function_name: lambdaFunctionName?.trim() || '',
            })
            .returning([
              'id', 'entity_ref', 'config_name', 'aws_region', 'aws_account_id',
              'aws_session_token', 'ecs_cluster_name', 'ecs_service_name',
              'lambda_function_name', 'created_at', 'updated_at',
            ]);
          return res.status(201).json(safeRow(row));
        });

        // PUT update existing config
        router.put('/:id', async (req, res) => {
          const {id} = req.params;
          const {
            configName, awsAccessKeyId, awsSecretAccessKey, awsSessionToken,
            awsRegion, awsAccountId, ecsClusterName, ecsServiceName, lambdaFunctionName,
          } = req.body;
          const updates: Record<string, any> = {
            updated_at: db.fn.now(),
            config_name: configName?.trim() || 'Default',
            aws_region: awsRegion?.trim() || 'us-east-1',
            aws_account_id: awsAccountId?.trim() || '',
            ecs_cluster_name: ecsClusterName?.trim() ?? '',
            ecs_service_name: ecsServiceName?.trim() ?? '',
            lambda_function_name: lambdaFunctionName?.trim() ?? '',
          };
          const updatingCredentials = Boolean(awsAccessKeyId?.trim());
          if (updatingCredentials) {
            updates.aws_access_key_id = awsAccessKeyId.trim();
            updates.aws_secret_access_key = awsSecretAccessKey?.trim() || undefined;
            // Only touch session token when replacing credentials as a whole
            updates.aws_session_token = awsSessionToken?.trim() || null;
          }
          await db(TABLE).where({id}).update(updates);
          const row = await db(TABLE)
            .where({id})
            .select(
              'id', 'entity_ref', 'config_name', 'aws_region', 'aws_account_id',
              'aws_session_token', 'ecs_cluster_name', 'ecs_service_name',
              'lambda_function_name', 'created_at', 'updated_at',
            )
            .first();
          return res.json(safeRow(row));
        });

        // DELETE config
        router.delete('/:id', async (req, res) => {
          await db(TABLE).where({id: req.params.id}).delete();
          return res.status(204).send();
        });

        // ── Cost Explorer ─────────────────────────────────────────────────────────

        router.get('/cost/:id', async (req, res) => {
          const {id} = req.params;
          const {startDate, endDate, granularity = 'MONTHLY'} = req.query;
          const row = await db(TABLE).where({id}).first();
          if (!row) return res.status(404).json({error: 'Config not found'});

          const credentials: {
            accessKeyId: string;
            secretAccessKey: string;
            sessionToken?: string;
          } = {
            accessKeyId: row.aws_access_key_id,
            secretAccessKey: row.aws_secret_access_key,
          };
          if (row.aws_session_token?.trim()) {
            credentials.sessionToken = row.aws_session_token.trim();
          }

          const client = new CostExplorerClient({region: 'us-east-1', credentials});

          const today = new Date().toISOString().split('T')[0];
          const sixMonthsAgo = (() => {
            const d = new Date();
            d.setMonth(d.getMonth() - 6);
            return d.toISOString().split('T')[0];
          })();

          try {
            const command = new GetCostAndUsageCommand({
              TimePeriod: {Start: (startDate as string) || sixMonthsAgo, End: (endDate as string) || today},
              Granularity: granularity as Granularity,
              Metrics: ['UnblendedCost'],
              GroupBy: [{Type: 'DIMENSION', Key: 'SERVICE'}],
            });
            return res.json(await client.send(command));
          } catch (err: any) {
            logger.error('AWS Cost Explorer error:', err);
            return res.status(500).json({error: err.message ?? 'AWS API error'});
          }
        });

        // ── ECS ───────────────────────────────────────────────────────────────────

        // GET /ecs/:id — full ECS dashboard data for a config
        router.get('/ecs/:id', async (req, res) => {
          const row = await db(TABLE).where({id: req.params.id}).first();
          if (!row) return res.status(404).json({error: 'Config not found'});

          const clusterName = row.ecs_cluster_name?.trim();
          const serviceName = row.ecs_service_name?.trim();
          if (!clusterName) {
            return res.status(400).json({error: 'No ECS cluster configured for this config'});
          }

          const ecs = makeEcsClient(row);

          try {
            // 1. Cluster details
            const clusterRes = await ecs.send(
              new DescribeClustersCommand({clusters: [clusterName]}),
            );
            const cluster = clusterRes.clusters?.[0] ?? null;

            // 2. Service details (if configured)
            let serviceNames: string[] = [];
            if (serviceName) {
              serviceNames = [serviceName];
            } else {
              // List all services in the cluster (up to 10)
              const listRes = await ecs.send(
                new ListServicesCommand({cluster: clusterName, maxResults: 10}),
              );
              serviceNames = (listRes.serviceArns ?? []).map(
                arn => arn.split('/').pop() ?? arn,
              );
            }

            let services: any[] = [];
            if (serviceNames.length > 0) {
              const svcRes = await ecs.send(
                new DescribeServicesCommand({cluster: clusterName, services: serviceNames}),
              );
              services = svcRes.services ?? [];
            }

            // 3. Running tasks for each service (up to 10 per service)
            const taskDetails: any[] = [];
            for (const svc of services.slice(0, 3)) {
              const listTasks = await ecs.send(
                new ListTasksCommand({
                  cluster: clusterName,
                  serviceName: svc.serviceName,
                  desiredStatus: 'RUNNING',
                  maxResults: 10,
                }),
              );
              if ((listTasks.taskArns ?? []).length > 0) {
                const descTasks = await ecs.send(
                  new DescribeTasksCommand({
                    cluster: clusterName,
                    tasks: listTasks.taskArns!,
                  }),
                );
                taskDetails.push({
                  serviceName: svc.serviceName,
                  tasks: (descTasks.tasks ?? []).map(t => ({
                    taskArn: t.taskArn,
                    lastStatus: t.lastStatus,
                    healthStatus: t.healthStatus,
                    startedAt: t.startedAt,
                    cpu: t.cpu,
                    memory: t.memory,
                    containers: (t.containers ?? []).map(c => ({
                      name: c.name,
                      lastStatus: c.lastStatus,
                      healthStatus: c.healthStatus,
                      exitCode: c.exitCode,
                    })),
                  })),
                });
              }
            }

            return res.json({
              cluster: cluster
                ? {
                    clusterName: cluster.clusterName,
                    status: cluster.status,
                    activeServicesCount: cluster.activeServicesCount,
                    runningTasksCount: cluster.runningTasksCount,
                    pendingTasksCount: cluster.pendingTasksCount,
                    registeredContainerInstancesCount: cluster.registeredContainerInstancesCount,
                    capacityProviders: cluster.capacityProviders,
                  }
                : null,
              services: services.map(s => ({
                serviceName: s.serviceName,
                status: s.status,
                desiredCount: s.desiredCount,
                runningCount: s.runningCount,
                pendingCount: s.pendingCount,
                launchType: s.launchType,
                taskDefinition: s.taskDefinition?.split('/').pop(),
                deployments: (s.deployments ?? []).map((d: any) => ({
                  status: d.status,
                  desiredCount: d.desiredCount,
                  runningCount: d.runningCount,
                  pendingCount: d.pendingCount,
                  createdAt: d.createdAt,
                  updatedAt: d.updatedAt,
                })),
                events: (s.events ?? []).slice(0, 5).map((e: any) => ({
                  createdAt: e.createdAt,
                  message: e.message,
                })),
              })),
              tasks: taskDetails,
            });
          } catch (err: any) {
            logger.error('AWS ECS error:', err);
            return res.status(500).json({error: err.message ?? 'AWS ECS API error'});
          }
        });

        // ── Lambda ────────────────────────────────────────────────────────────────

        // GET /lambda-summary/:id — Aggregated Lambda summary for all functions
        router.get('/lambda-summary/:id', async (req, res) => {
          const row = await db(TABLE).where({id: req.params.id}).first();
          if (!row) return res.status(404).json({error: 'Config not found'});

          const lambda = makeLambdaClient(row);
          const cloudwatch = makeCloudWatchClient(row);

          try {
            // 1. List all Lambda functions
            const {ListFunctionsCommand, GetAccountSettingsCommand} =
              await import('@aws-sdk/client-lambda');
            const listResult = await lambda.send(new ListFunctionsCommand({}));
            const functions = listResult.Functions ?? [];

            // 2. Calculate summary stats
            const totalFunctions = functions.length;
            const totalCodeSize = functions.reduce((sum, f) => sum + (f.CodeSize ?? 0), 0);

            // 3. Get account settings for concurrency
            const accountSettings = await lambda.send(new GetAccountSettingsCommand({}));
            const accountConcurrency =
              accountSettings.AccountLimit?.ConcurrentExecutions ?? 1000;
            const reservedConcurrency = accountSettings.AccountUsage?.FunctionCount ?? 0;
            const unreservedConcurrency = accountConcurrency - reservedConcurrency;

            // 4. Get metrics for the last 3 hours for top functions
            const endTime = new Date();
            const startTime = new Date(endTime.getTime() - 3 * 60 * 60 * 1000);

            // Get metrics for each function (limit to first 50 for performance)
            const functionsToCheck = functions.slice(0, 50);
            const functionMetrics = await Promise.all(
              functionsToCheck.map(async func => {
                try {
                  const [invocations, errors, concurrentExecs] = await Promise.all([
                    cloudwatch.send(
                      new GetMetricStatisticsCommand({
                        Namespace: 'AWS/Lambda',
                        MetricName: 'Invocations',
                        Dimensions: [{Name: 'FunctionName', Value: func.FunctionName!}],
                        StartTime: startTime,
                        EndTime: endTime,
                        Period: 3600,
                        Statistics: ['Sum' as Statistic],
                      }),
                    ),
                    cloudwatch.send(
                      new GetMetricStatisticsCommand({
                        Namespace: 'AWS/Lambda',
                        MetricName: 'Errors',
                        Dimensions: [{Name: 'FunctionName', Value: func.FunctionName!}],
                        StartTime: startTime,
                        EndTime: endTime,
                        Period: 3600,
                        Statistics: ['Sum' as Statistic],
                      }),
                    ),
                    cloudwatch.send(
                      new GetMetricStatisticsCommand({
                        Namespace: 'AWS/Lambda',
                        MetricName: 'ConcurrentExecutions',
                        Dimensions: [{Name: 'FunctionName', Value: func.FunctionName!}],
                        StartTime: startTime,
                        EndTime: endTime,
                        Period: 3600,
                        Statistics: ['Maximum' as Statistic],
                      }),
                    ),
                  ]);

                  const totalInvocations = (invocations.Datapoints ?? []).reduce(
                    (sum, dp) => sum + (dp.Sum ?? 0),
                    0,
                  );
                  const totalErrors = (errors.Datapoints ?? []).reduce(
                    (sum, dp) => sum + (dp.Sum ?? 0),
                    0,
                  );
                  const maxConcurrent = Math.max(
                    ...(concurrentExecs.Datapoints ?? []).map(dp => dp.Maximum ?? 0),
                    0,
                  );

                  return {
                    functionName: func.FunctionName!,
                    invocations: totalInvocations,
                    errors: totalErrors,
                    concurrentExecutions: maxConcurrent,
                    invocationsDatapoints: invocations.Datapoints ?? [],
                    errorsDatapoints: errors.Datapoints ?? [],
                    concurrentDatapoints: concurrentExecs.Datapoints ?? [],
                  };
                } catch (err) {
                  logger.warn(`Failed to get metrics for ${func.FunctionName}:`, err);
                  return {
                    functionName: func.FunctionName!,
                    invocations: 0,
                    errors: 0,
                    concurrentExecutions: 0,
                    invocationsDatapoints: [],
                    errorsDatapoints: [],
                    concurrentDatapoints: [],
                  };
                }
              }),
            );

            // 5. Sort and get top 10 by each metric
            const topByErrors = [...functionMetrics]
              .sort((a, b) => b.errors - a.errors)
              .slice(0, 10);
            const topByInvocations = [...functionMetrics]
              .sort((a, b) => b.invocations - a.invocations)
              .slice(0, 10);
            const topByConcurrent = [...functionMetrics]
              .sort((a, b) => b.concurrentExecutions - a.concurrentExecutions)
              .slice(0, 10);

            return res.json({
              summary: {
                totalFunctions,
                totalCodeSize,
                accountConcurrency,
                unreservedConcurrency,
              },
              topFunctions: {
                byErrors: topByErrors,
                byInvocations: topByInvocations,
                byConcurrent: topByConcurrent,
              },
            });
          } catch (err: any) {
            logger.error('AWS Lambda summary error:', err);
            return res.status(500).json({error: err.message ?? 'AWS Lambda API error'});
          }
        });

        // GET /lambda/:id — Lambda function details and metrics
        router.get('/lambda/:id', async (req, res) => {
          const row = await db(TABLE).where({id: req.params.id}).first();
          if (!row) return res.status(404).json({error: 'Config not found'});

          const functionName = row.lambda_function_name?.trim();
          if (!functionName) {
            return res.status(400).json({error: 'No Lambda function configured for this config'});
          }

          const lambda = makeLambdaClient(row);
          const cloudwatch = makeCloudWatchClient(row);

          try {
            // 1. Get function configuration
            const funcConfigRes = await lambda.send(
              new GetFunctionConfigurationCommand({FunctionName: functionName}),
            );

            // 2. Get CloudWatch metrics for the last 24 hours
            const endTime = new Date();
            const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

            const metricPromises = [
              // Invocations
              cloudwatch.send(
                new GetMetricStatisticsCommand({
                  Namespace: 'AWS/Lambda',
                  MetricName: 'Invocations',
                  Dimensions: [{Name: 'FunctionName', Value: functionName}],
                  StartTime: startTime,
                  EndTime: endTime,
                  Period: 3600, // 1 hour
                  Statistics: ['Sum' as Statistic],
                }),
              ),
              // Errors
              cloudwatch.send(
                new GetMetricStatisticsCommand({
                  Namespace: 'AWS/Lambda',
                  MetricName: 'Errors',
                  Dimensions: [{Name: 'FunctionName', Value: functionName}],
                  StartTime: startTime,
                  EndTime: endTime,
                  Period: 3600,
                  Statistics: ['Sum' as Statistic],
                }),
              ),
              // Duration
              cloudwatch.send(
                new GetMetricStatisticsCommand({
                  Namespace: 'AWS/Lambda',
                  MetricName: 'Duration',
                  Dimensions: [{Name: 'FunctionName', Value: functionName}],
                  StartTime: startTime,
                  EndTime: endTime,
                  Period: 3600,
                  Statistics: ['Average' as Statistic, 'Maximum' as Statistic],
                  Unit: 'Milliseconds' as StandardUnit,
                }),
              ),
              // Throttles
              cloudwatch.send(
                new GetMetricStatisticsCommand({
                  Namespace: 'AWS/Lambda',
                  MetricName: 'Throttles',
                  Dimensions: [{Name: 'FunctionName', Value: functionName}],
                  StartTime: startTime,
                  EndTime: endTime,
                  Period: 3600,
                  Statistics: ['Sum' as Statistic],
                }),
              ),
              // Concurrent Executions
              cloudwatch.send(
                new GetMetricStatisticsCommand({
                  Namespace: 'AWS/Lambda',
                  MetricName: 'ConcurrentExecutions',
                  Dimensions: [{Name: 'FunctionName', Value: functionName}],
                  StartTime: startTime,
                  EndTime: endTime,
                  Period: 3600,
                  Statistics: ['Maximum' as Statistic],
                }),
              ),
            ];

            const [invocations, errors, duration, throttles, concurrentExecutions] =
              await Promise.all(metricPromises);

            return res.json({
              function: {
                functionName: funcConfigRes.FunctionName,
                functionArn: funcConfigRes.FunctionArn,
                runtime: funcConfigRes.Runtime,
                handler: funcConfigRes.Handler,
                codeSize: funcConfigRes.CodeSize,
                description: funcConfigRes.Description,
                timeout: funcConfigRes.Timeout,
                memorySize: funcConfigRes.MemorySize,
                lastModified: funcConfigRes.LastModified,
                version: funcConfigRes.Version,
                state: funcConfigRes.State,
                stateReason: funcConfigRes.StateReason,
                role: funcConfigRes.Role,
                environment: funcConfigRes.Environment?.Variables,
              },
              metrics: {
                invocations: invocations.Datapoints ?? [],
                errors: errors.Datapoints ?? [],
                duration: duration.Datapoints ?? [],
                throttles: throttles.Datapoints ?? [],
                concurrentExecutions: concurrentExecutions.Datapoints ?? [],
              },
            });
          } catch (err: any) {
            logger.error('AWS Lambda error:', err);
            return res.status(500).json({error: err.message ?? 'AWS Lambda API error'});
          }
        });

        httpRouter.use(router);
        httpRouter.addAuthPolicy({
          path: '/aws-cost-settings',
          allow: 'unauthenticated',
        });
        logger.info('aws-cost-settings plugin registered at /api/aws-cost-settings');
      },
    });
  },
});
