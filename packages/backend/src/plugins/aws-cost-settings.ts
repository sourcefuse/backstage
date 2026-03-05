import {coreServices, createBackendPlugin} from '@backstage/backend-plugin-api';
import Router from 'express-promise-router';
import express from 'express';
import AWS from 'aws-sdk';

const TABLE = 'plugin_aws_cost_entity_settings';

function makeCredentials(row: any): AWS.Credentials {
  const opts: any = {
    accessKeyId: row.aws_access_key_id,
    secretAccessKey: row.aws_secret_access_key,
  };
  if (row.aws_session_token?.trim()) {
    opts.sessionToken = row.aws_session_token.trim();
  }
  return new AWS.Credentials(opts);
}

function region(row: any) {
  return row.aws_region || 'us-east-1';
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
            table.text('aws_access_key_id').notNullable();
            table.text('aws_secret_access_key').notNullable();
            table.text('aws_session_token').nullable();
            table.string('aws_region', 64).notNullable().defaultTo('us-east-1');
            table.string('aws_account_id', 32).defaultTo('');
            table.string('ecs_cluster_name', 255).defaultTo('');
            table.string('ecs_service_name', 255).defaultTo('');
            table.string('lambda_function_name', 255).defaultTo('');
            table.timestamps(true, true);
            table.unique(['entity_ref', 'config_name']);
          });
          logger.info('Created plugin_aws_cost_entity_settings table');
        } else {
          const hasSessionToken = await db.schema.hasColumn(TABLE, 'aws_session_token');
          if (!hasSessionToken) {
            await db.schema.alterTable(TABLE, t => { t.text('aws_session_token').nullable(); });
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
            await db.schema.alterTable(TABLE, t => { t.string('lambda_function_name', 255).defaultTo(''); });
            logger.info('Migrated: added lambda_function_name column');
          }
        }

        const router = Router();
        router.use(express.json());

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

        router.post('/', async (req, res) => {
          const {
            entityRef, configName, awsAccessKeyId, awsSecretAccessKey,
            awsSessionToken, awsRegion, awsAccountId,
            ecsClusterName, ecsServiceName, lambdaFunctionName,
          } = req.body;
          if (!entityRef || !awsAccessKeyId || !awsSecretAccessKey) {
            return res.status(400).json({error: 'entityRef, awsAccessKeyId and awsSecretAccessKey are required'});
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

          const ce = new AWS.CostExplorer({region: 'us-east-1', credentials: makeCredentials(row)});

          const today = new Date().toISOString().split('T')[0];
          const sixMonthsAgo = (() => {
            const d = new Date(); d.setMonth(d.getMonth() - 6);
            return d.toISOString().split('T')[0];
          })();

          try {
            const result = await ce.getCostAndUsage({
              TimePeriod: {Start: (startDate as string) || sixMonthsAgo, End: (endDate as string) || today},
              Granularity: (granularity as string) || 'MONTHLY',
              Metrics: ['UnblendedCost'],
              GroupBy: [{Type: 'DIMENSION', Key: 'SERVICE'}],
            }).promise();
            return res.json(result);
          } catch (err: any) {
            logger.error('AWS Cost Explorer error:', err);
            return res.status(500).json({error: err.message ?? 'AWS API error'});
          }
        });

        // ── ECS ───────────────────────────────────────────────────────────────────

        router.get('/ecs/:id', async (req, res) => {
          const row = await db(TABLE).where({id: req.params.id}).first();
          if (!row) return res.status(404).json({error: 'Config not found'});

          const clusterName = row.ecs_cluster_name?.trim();
          const serviceName = row.ecs_service_name?.trim();
          if (!clusterName) return res.status(400).json({error: 'No ECS cluster configured for this config'});

          const ecs = new AWS.ECS({region: region(row), credentials: makeCredentials(row)});

          try {
            const clusterRes = await ecs.describeClusters({clusters: [clusterName]}).promise();
            const cluster = clusterRes.clusters?.[0] ?? null;

            let serviceNames: string[] = [];
            if (serviceName) {
              serviceNames = [serviceName];
            } else {
              const listRes = await ecs.listServices({cluster: clusterName, maxResults: 10}).promise();
              serviceNames = (listRes.serviceArns ?? []).map(arn => arn.split('/').pop() ?? arn);
            }

            let services: any[] = [];
            if (serviceNames.length > 0) {
              const svcRes = await ecs.describeServices({cluster: clusterName, services: serviceNames}).promise();
              services = svcRes.services ?? [];
            }

            const taskDetails: any[] = [];
            for (const svc of services.slice(0, 3)) {
              const listTasks = await ecs.listTasks({
                cluster: clusterName, serviceName: svc.serviceName,
                desiredStatus: 'RUNNING', maxResults: 10,
              }).promise();
              if ((listTasks.taskArns ?? []).length > 0) {
                const descTasks = await ecs.describeTasks({cluster: clusterName, tasks: listTasks.taskArns!}).promise();
                taskDetails.push({
                  serviceName: svc.serviceName,
                  tasks: (descTasks.tasks ?? []).map(t => ({
                    taskArn: t.taskArn, lastStatus: t.lastStatus, healthStatus: t.healthStatus,
                    startedAt: t.startedAt, cpu: t.cpu, memory: t.memory,
                    containers: (t.containers ?? []).map(c => ({
                      name: c.name, lastStatus: c.lastStatus, healthStatus: c.healthStatus, exitCode: c.exitCode,
                    })),
                  })),
                });
              }
            }

            return res.json({
              cluster: cluster ? {
                clusterName: cluster.clusterName, status: cluster.status,
                activeServicesCount: cluster.activeServicesCount,
                runningTasksCount: cluster.runningTasksCount,
                pendingTasksCount: cluster.pendingTasksCount,
                registeredContainerInstancesCount: cluster.registeredContainerInstancesCount,
                capacityProviders: cluster.capacityProviders,
              } : null,
              services: services.map(s => ({
                serviceName: s.serviceName, status: s.status,
                desiredCount: s.desiredCount, runningCount: s.runningCount, pendingCount: s.pendingCount,
                launchType: s.launchType,
                taskDefinition: s.taskDefinition?.split('/').pop(),
                deployments: (s.deployments ?? []).map((d: any) => ({
                  status: d.status, desiredCount: d.desiredCount, runningCount: d.runningCount,
                  pendingCount: d.pendingCount, createdAt: d.createdAt, updatedAt: d.updatedAt,
                })),
                events: (s.events ?? []).slice(0, 5).map((e: any) => ({createdAt: e.createdAt, message: e.message})),
              })),
              tasks: taskDetails,
            });
          } catch (err: any) {
            logger.error('AWS ECS error:', err);
            return res.status(500).json({error: err.message ?? 'AWS ECS API error'});
          }
        });

        // ── Lambda ────────────────────────────────────────────────────────────────

        router.get('/lambda-summary/:id', async (req, res) => {
          const row = await db(TABLE).where({id: req.params.id}).first();
          if (!row) return res.status(404).json({error: 'Config not found'});

          const lambda = new AWS.Lambda({region: region(row), credentials: makeCredentials(row)});
          const cw = new AWS.CloudWatch({region: region(row), credentials: makeCredentials(row)});

          try {
            const listResult = await lambda.listFunctions().promise();
            const functions = listResult.Functions ?? [];
            const totalFunctions = functions.length;
            const totalCodeSize = functions.reduce((sum, f) => sum + (f.CodeSize ?? 0), 0);

            const accountSettings = await lambda.getAccountSettings().promise();
            const accountConcurrency = accountSettings.AccountLimit?.ConcurrentExecutions ?? 1000;
            const reservedConcurrency = accountSettings.AccountUsage?.FunctionCount ?? 0;
            const unreservedConcurrency = accountConcurrency - reservedConcurrency;

            const endTime = new Date();
            const startTime = new Date(endTime.getTime() - 3 * 60 * 60 * 1000);

            const functionsToCheck = functions.slice(0, 50);
            const functionMetrics = await Promise.all(
              functionsToCheck.map(async func => {
                try {
                  const dims = [{Name: 'FunctionName', Value: func.FunctionName!}];
                  const [invocations, errors, concurrentExecs] = await Promise.all([
                    cw.getMetricStatistics({Namespace: 'AWS/Lambda', MetricName: 'Invocations', Dimensions: dims, StartTime: startTime, EndTime: endTime, Period: 3600, Statistics: ['Sum']}).promise(),
                    cw.getMetricStatistics({Namespace: 'AWS/Lambda', MetricName: 'Errors', Dimensions: dims, StartTime: startTime, EndTime: endTime, Period: 3600, Statistics: ['Sum']}).promise(),
                    cw.getMetricStatistics({Namespace: 'AWS/Lambda', MetricName: 'ConcurrentExecutions', Dimensions: dims, StartTime: startTime, EndTime: endTime, Period: 3600, Statistics: ['Maximum']}).promise(),
                  ]);
                  return {
                    functionName: func.FunctionName!,
                    invocations: (invocations.Datapoints ?? []).reduce((sum, dp) => sum + (dp.Sum ?? 0), 0),
                    errors: (errors.Datapoints ?? []).reduce((sum, dp) => sum + (dp.Sum ?? 0), 0),
                    concurrentExecutions: Math.max(...(concurrentExecs.Datapoints ?? []).map(dp => dp.Maximum ?? 0), 0),
                    invocationsDatapoints: invocations.Datapoints ?? [],
                    errorsDatapoints: errors.Datapoints ?? [],
                    concurrentDatapoints: concurrentExecs.Datapoints ?? [],
                  };
                } catch (err) {
                  logger.warn(`Failed to get metrics for ${func.FunctionName}:`, err);
                  return {functionName: func.FunctionName!, invocations: 0, errors: 0, concurrentExecutions: 0, invocationsDatapoints: [], errorsDatapoints: [], concurrentDatapoints: []};
                }
              }),
            );

            return res.json({
              summary: {totalFunctions, totalCodeSize, accountConcurrency, unreservedConcurrency},
              topFunctions: {
                byErrors: [...functionMetrics].sort((a, b) => b.errors - a.errors).slice(0, 10),
                byInvocations: [...functionMetrics].sort((a, b) => b.invocations - a.invocations).slice(0, 10),
                byConcurrent: [...functionMetrics].sort((a, b) => b.concurrentExecutions - a.concurrentExecutions).slice(0, 10),
              },
            });
          } catch (err: any) {
            logger.error('AWS Lambda summary error:', err);
            return res.status(500).json({error: err.message ?? 'AWS Lambda API error'});
          }
        });

        router.get('/lambda/:id', async (req, res) => {
          const row = await db(TABLE).where({id: req.params.id}).first();
          if (!row) return res.status(404).json({error: 'Config not found'});

          const functionName = row.lambda_function_name?.trim();
          if (!functionName) return res.status(400).json({error: 'No Lambda function configured for this config'});

          const lambda = new AWS.Lambda({region: region(row), credentials: makeCredentials(row)});
          const cw = new AWS.CloudWatch({region: region(row), credentials: makeCredentials(row)});

          try {
            const funcConfigRes = await lambda.getFunctionConfiguration({FunctionName: functionName}).promise();
            const endTime = new Date();
            const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
            const dims = [{Name: 'FunctionName', Value: functionName}];

            const [invocations, errors, duration, throttles, concurrentExecutions] = await Promise.all([
              cw.getMetricStatistics({Namespace: 'AWS/Lambda', MetricName: 'Invocations', Dimensions: dims, StartTime: startTime, EndTime: endTime, Period: 3600, Statistics: ['Sum']}).promise(),
              cw.getMetricStatistics({Namespace: 'AWS/Lambda', MetricName: 'Errors', Dimensions: dims, StartTime: startTime, EndTime: endTime, Period: 3600, Statistics: ['Sum']}).promise(),
              cw.getMetricStatistics({Namespace: 'AWS/Lambda', MetricName: 'Duration', Dimensions: dims, StartTime: startTime, EndTime: endTime, Period: 3600, Statistics: ['Average', 'Maximum'], Unit: 'Milliseconds'}).promise(),
              cw.getMetricStatistics({Namespace: 'AWS/Lambda', MetricName: 'Throttles', Dimensions: dims, StartTime: startTime, EndTime: endTime, Period: 3600, Statistics: ['Sum']}).promise(),
              cw.getMetricStatistics({Namespace: 'AWS/Lambda', MetricName: 'ConcurrentExecutions', Dimensions: dims, StartTime: startTime, EndTime: endTime, Period: 3600, Statistics: ['Maximum']}).promise(),
            ]);

            return res.json({
              function: {
                functionName: funcConfigRes.FunctionName, functionArn: funcConfigRes.FunctionArn,
                runtime: funcConfigRes.Runtime, handler: funcConfigRes.Handler,
                codeSize: funcConfigRes.CodeSize, description: funcConfigRes.Description,
                timeout: funcConfigRes.Timeout, memorySize: funcConfigRes.MemorySize,
                lastModified: funcConfigRes.LastModified, version: funcConfigRes.Version,
                state: funcConfigRes.State, stateReason: funcConfigRes.StateReason,
                role: funcConfigRes.Role, environment: funcConfigRes.Environment?.Variables,
              },
              metrics: {
                invocations: invocations.Datapoints ?? [], errors: errors.Datapoints ?? [],
                duration: duration.Datapoints ?? [], throttles: throttles.Datapoints ?? [],
                concurrentExecutions: concurrentExecutions.Datapoints ?? [],
              },
            });
          } catch (err: any) {
            logger.error('AWS Lambda error:', err);
            return res.status(500).json({error: err.message ?? 'AWS Lambda API error'});
          }
        });

        // ── EC2 ────────────────────────────────────────────────────────────────

        router.get('/ec2/:id', async (req, res) => {
          const row = await db(TABLE).where({id: req.params.id}).first();
          if (!row) return res.status(404).json({error: 'Config not found'});

          const ec2 = new AWS.EC2({region: region(row), credentials: makeCredentials(row)});

          try {
            const result = await ec2.describeInstances().promise();
            const instances: any[] = [];
            for (const reservation of result.Reservations ?? []) {
              for (const inst of reservation.Instances ?? []) {
                const nameTag = (inst.Tags ?? []).find(t => t.Key === 'Name');
                instances.push({
                  instanceId: inst.InstanceId, instanceType: inst.InstanceType,
                  state: inst.State?.Name, stateCode: inst.State?.Code,
                  name: nameTag?.Value ?? '',
                  publicIp: inst.PublicIpAddress ?? null, privateIp: inst.PrivateIpAddress ?? null,
                  launchTime: inst.LaunchTime, vpcId: inst.VpcId ?? null, subnetId: inst.SubnetId ?? null,
                  platform: inst.PlatformDetails ?? inst.Platform ?? 'Linux/UNIX',
                  architecture: inst.Architecture ?? null, monitoring: inst.Monitoring?.State ?? null,
                  availabilityZone: inst.Placement?.AvailabilityZone ?? null, keyName: inst.KeyName ?? null,
                  securityGroups: (inst.SecurityGroups ?? []).map(sg => ({groupId: sg.GroupId, groupName: sg.GroupName})),
                  tags: (inst.Tags ?? []).reduce((acc: Record<string, string>, tag) => {
                    if (tag.Key && tag.Value) acc[tag.Key] = tag.Value;
                    return acc;
                  }, {}),
                });
              }
            }
            instances.sort((a, b) => {
              if (a.state === 'running' && b.state !== 'running') return -1;
              if (a.state !== 'running' && b.state === 'running') return 1;
              return (a.name || a.instanceId).localeCompare(b.name || b.instanceId);
            });
            return res.json({
              totalInstances: instances.length,
              runningCount: instances.filter(i => i.state === 'running').length,
              stoppedCount: instances.filter(i => i.state === 'stopped').length,
              instances,
            });
          } catch (err: any) {
            logger.error('AWS EC2 error:', err);
            return res.status(500).json({error: err.message ?? 'AWS EC2 API error'});
          }
        });

        // ── S3 ─────────────────────────────────────────────────────────────────

        router.get('/s3/:id', async (req, res) => {
          const row = await db(TABLE).where({id: req.params.id}).first();
          if (!row) return res.status(404).json({error: 'Config not found'});

          const s3 = new AWS.S3({region: region(row), credentials: makeCredentials(row)});

          try {
            const result = await s3.listBuckets().promise();
            const buckets = (result.Buckets ?? []).map(b => ({
              name: b.Name ?? '',
              creationDate: b.CreationDate?.toISOString() ?? null,
              region: null as string | null,
            }));

            for (const bucket of buckets.slice(0, 20)) {
              try {
                const loc = await s3.getBucketLocation({Bucket: bucket.name}).promise();
                bucket.region = loc.LocationConstraint || 'us-east-1';
              } catch { /* ignore permission errors */ }
            }

            return res.json({totalBuckets: buckets.length, buckets});
          } catch (err: any) {
            logger.error('AWS S3 error:', err);
            return res.status(500).json({error: err.message ?? 'AWS S3 API error'});
          }
        });

        // ── RDS ────────────────────────────────────────────────────────────────

        router.get('/rds/:id', async (req, res) => {
          const row = await db(TABLE).where({id: req.params.id}).first();
          if (!row) return res.status(404).json({error: 'Config not found'});

          const rds = new AWS.RDS({region: region(row), credentials: makeCredentials(row)});

          try {
            const result = await rds.describeDBInstances().promise();
            const instances = (result.DBInstances ?? []).map(d => ({
              dbInstanceIdentifier: d.DBInstanceIdentifier ?? '',
              dbInstanceClass: d.DBInstanceClass ?? '',
              engine: d.Engine ?? '',
              engineVersion: d.EngineVersion ?? '',
              status: d.DBInstanceStatus ?? '',
              endpoint: d.Endpoint?.Address ?? null,
              port: d.Endpoint?.Port ?? null,
              allocatedStorage: d.AllocatedStorage ?? 0,
              multiAZ: d.MultiAZ ?? false,
              availabilityZone: d.AvailabilityZone ?? null,
              storageType: d.StorageType ?? '',
              storageEncrypted: d.StorageEncrypted ?? false,
              enabledCloudwatchLogsExports: d.EnabledCloudwatchLogsExports ?? [],
            }));
            return res.json({totalInstances: instances.length, instances});
          } catch (err: any) {
            logger.error('AWS RDS error:', err);
            return res.status(500).json({error: err.message ?? 'AWS RDS API error'});
          }
        });

        // ── RDS Log Files ──────────────────────────────────────────────────────

        router.get('/rds/:id/logfiles', async (req, res) => {
          const row = await db(TABLE).where({id: req.params.id}).first();
          if (!row) return res.status(404).json({error: 'Config not found'});

          const {dbInstanceId} = req.query as {dbInstanceId?: string};
          if (!dbInstanceId) return res.status(400).json({error: 'dbInstanceId query param required'});

          const rds = new AWS.RDS({region: region(row), credentials: makeCredentials(row)});
          try {
            const result = await rds.describeDBLogFiles({
              DBInstanceIdentifier: dbInstanceId,
              MaxRecords: 50,
            }).promise();
            const files = (result.DescribeDBLogFiles ?? []).map(f => ({
              logFileName: f.LogFileName ?? '',
              lastWritten: f.LastWritten ?? 0,
              size: f.Size ?? 0,
            }));
            // Sort newest first
            files.sort((a, b) => b.lastWritten - a.lastWritten);
            return res.json({files});
          } catch (err: any) {
            logger.error('AWS RDS log files error:', err);
            return res.status(500).json({error: err.message ?? 'RDS log files API error'});
          }
        });

        // ── RDS Log Content ────────────────────────────────────────────────────

        router.get('/rds/:id/logcontent', async (req, res) => {
          const row = await db(TABLE).where({id: req.params.id}).first();
          if (!row) return res.status(404).json({error: 'Config not found'});

          const {dbInstanceId, logFileName} = req.query as {dbInstanceId?: string; logFileName?: string};
          if (!dbInstanceId || !logFileName) {
            return res.status(400).json({error: 'dbInstanceId and logFileName query params required'});
          }

          const rds = new AWS.RDS({region: region(row), credentials: makeCredentials(row)});
          try {
            const result = await rds.downloadDBLogFilePortion({
              DBInstanceIdentifier: dbInstanceId,
              LogFileName: logFileName,
              NumberOfLines: 200,
            }).promise();
            return res.json({logFileData: result.LogFileData ?? '', marker: result.Marker ?? null});
          } catch (err: any) {
            logger.error('AWS RDS log content error:', err);
            return res.status(500).json({error: err.message ?? 'RDS log content API error'});
          }
        });

        // ── CloudFront ─────────────────────────────────────────────────────────

        router.get('/cloudfront/:id', async (req, res) => {
          const row = await db(TABLE).where({id: req.params.id}).first();
          if (!row) return res.status(404).json({error: 'Config not found'});

          const cf = new AWS.CloudFront({region: 'us-east-1', credentials: makeCredentials(row)});

          try {
            const result = await cf.listDistributions().promise();
            const items = result.DistributionList?.Items ?? [];
            const distributions = items.map(d => ({
              id: d.Id ?? '',
              domainName: d.DomainName ?? '',
              status: d.Status ?? '',
              enabled: d.Enabled ?? false,
              aliases: d.Aliases?.Items ?? [],
              origins: (d.Origins?.Items ?? []).map(o => o.DomainName ?? ''),
              priceClass: d.PriceClass ?? '',
              lastModified: d.LastModifiedTime?.toISOString() ?? null,
            }));
            return res.json({totalDistributions: distributions.length, distributions});
          } catch (err: any) {
            logger.error('AWS CloudFront error:', err);
            return res.status(500).json({error: err.message ?? 'AWS CloudFront API error'});
          }
        });

        // ── OpenSearch ─────────────────────────────────────────────────────────

        router.get('/opensearch/:id', async (req, res) => {
          const row = await db(TABLE).where({id: req.params.id}).first();
          if (!row) return res.status(404).json({error: 'Config not found'});

          const os = new AWS.OpenSearch({region: region(row), credentials: makeCredentials(row)});

          try {
            const listResult = await os.listDomainNames().promise();
            const domainNames = (listResult.DomainNames ?? []).map(d => d.DomainName!).filter(Boolean);

            if (domainNames.length === 0) {
              return res.json({totalDomains: 0, domains: []});
            }

            const descResult = await os.describeDomains({DomainNames: domainNames}).promise();
            const domains = (descResult.DomainStatusList ?? []).map(d => {
              const logOpts: Record<string, {enabled: boolean; cloudWatchLogsLogGroupArn: string}> = {};
              for (const [logType, opt] of Object.entries(d.LogPublishingOptions ?? {})) {
                if (opt) {
                  logOpts[logType] = {
                    enabled: opt.Enabled ?? false,
                    cloudWatchLogsLogGroupArn: opt.CloudWatchLogsLogGroupArn ?? '',
                  };
                }
              }
              return {
                domainName: d.DomainName ?? '',
                engineVersion: d.EngineVersion ?? '',
                endpoint: d.Endpoint ?? d.Endpoints?.vpc ?? null,
                instanceType: d.ClusterConfig?.InstanceType ?? '',
                instanceCount: d.ClusterConfig?.InstanceCount ?? 1,
                storageType: d.EBSOptions?.VolumeType ?? '',
                ebsVolumeSize: d.EBSOptions?.VolumeSize ?? null,
                processing: d.Processing ?? false,
                created: d.Created ?? false,
                deleted: d.Deleted ?? false,
                logPublishingOptions: logOpts,
              };
            });
            return res.json({totalDomains: domains.length, domains});
          } catch (err: any) {
            logger.error('AWS OpenSearch error:', err);
            return res.status(500).json({error: err.message ?? 'AWS OpenSearch API error'});
          }
        });

        // ── OpenSearch Logs ────────────────────────────────────────────────────

        router.get('/opensearch/:id/logs', async (req, res) => {
          const row = await db(TABLE).where({id: req.params.id}).first();
          if (!row) return res.status(404).json({error: 'Config not found'});

          const {logGroupArn, limit} = req.query as {logGroupArn?: string; limit?: string};
          if (!logGroupArn) return res.status(400).json({error: 'logGroupArn query param required'});

          // Convert ARN to log group name (arn:aws:logs:region:account:log-group:/name)
          const arnParts = logGroupArn.split(':');
          const logGroupName = arnParts.slice(6).join(':') || arnParts[6];

          const cwl = new AWS.CloudWatchLogs({region: region(row), credentials: makeCredentials(row)});
          try {
            // Get log streams sorted by last event time
            const streamsResp = await cwl.describeLogStreams({
              logGroupName,
              orderBy: 'LastEventTime',
              descending: true,
              limit: 5,
            }).promise();

            const streams = (streamsResp.logStreams ?? []).map(s => s.logStreamName!).filter(Boolean);
            if (streams.length === 0) {
              return res.json({events: []});
            }

            const maxEvents = Math.min(parseInt(limit ?? '100', 10), 500);
            const allEvents: {timestamp: number; message: string; logStream: string}[] = [];

            for (const streamName of streams.slice(0, 3)) {
              const eventsResp = await cwl.getLogEvents({
                logGroupName,
                logStreamName: streamName,
                startFromHead: false,
                limit: Math.ceil(maxEvents / streams.slice(0, 3).length),
              }).promise();
              for (const e of eventsResp.events ?? []) {
                allEvents.push({
                  timestamp: e.timestamp ?? 0,
                  message: e.message ?? '',
                  logStream: streamName,
                });
              }
            }

            allEvents.sort((a, b) => b.timestamp - a.timestamp);
            return res.json({events: allEvents.slice(0, maxEvents)});
          } catch (err: any) {
            logger.error('AWS OpenSearch logs error:', err);
            return res.status(500).json({error: err.message ?? 'CloudWatch logs error'});
          }
        });

        // ── CodeBuild ──────────────────────────────────────────────────────────

        router.get('/codebuild/:id', async (req, res) => {
          const row = await db(TABLE).where({id: req.params.id}).first();
          if (!row) return res.status(404).json({error: 'Config not found'});

          const cb = new AWS.CodeBuild({region: region(row), credentials: makeCredentials(row)});
          try {
            const listResult = await cb.listProjects({sortBy: 'LAST_MODIFIED_TIME', sortOrder: 'DESCENDING'}).promise();
            const names = listResult.projects ?? [];
            if (names.length === 0) return res.json({totalProjects: 0, projects: []});

            const details = await cb.batchGetProjects({names: names.slice(0, 25)}).promise();
            const projects = await Promise.all((details.projects ?? []).map(async p => {
              let lastBuild: any = null;
              try {
                const buildsResp = await cb.listBuildsForProject({projectName: p.name!, sortOrder: 'DESCENDING'}).promise();
                const buildIds = (buildsResp.ids ?? []).slice(0, 1);
                if (buildIds.length > 0) {
                  const buildDetails = await cb.batchGetBuilds({ids: buildIds}).promise();
                  const b = buildDetails.builds?.[0];
                  if (b) {
                    lastBuild = {
                      id: b.id ?? '',
                      status: b.buildStatus ?? '',
                      startTime: b.startTime?.toISOString() ?? null,
                      endTime: b.endTime?.toISOString() ?? null,
                      initiator: b.initiator ?? null,
                    };
                  }
                }
              } catch (_) { /* ignore per-project build fetch errors */ }
              return {
                name: p.name ?? '',
                arn: p.arn ?? '',
                description: p.description ?? null,
                sourceType: p.source?.type ?? '',
                sourceLocation: p.source?.location ?? null,
                environmentType: p.environment?.type ?? '',
                environmentImage: p.environment?.image ?? '',
                serviceRole: p.serviceRole ?? null,
                created: p.created?.toISOString() ?? null,
                lastModified: p.lastModified?.toISOString() ?? null,
                lastBuild,
              };
            }));
            return res.json({totalProjects: projects.length, projects});
          } catch (err: any) {
            logger.error('AWS CodeBuild error:', err);
            return res.status(500).json({error: err.message ?? 'CodeBuild API error'});
          }
        });

        router.get('/codebuild/:id/builds', async (req, res) => {
          const row = await db(TABLE).where({id: req.params.id}).first();
          if (!row) return res.status(404).json({error: 'Config not found'});

          const {projectName} = req.query as {projectName?: string};
          if (!projectName) return res.status(400).json({error: 'projectName query param required'});

          const cb = new AWS.CodeBuild({region: region(row), credentials: makeCredentials(row)});
          try {
            const listResp = await cb.listBuildsForProject({projectName, sortOrder: 'DESCENDING'}).promise();
            const ids = (listResp.ids ?? []).slice(0, 10);
            if (ids.length === 0) return res.json({builds: []});

            const details = await cb.batchGetBuilds({ids}).promise();
            const builds = (details.builds ?? []).map(b => ({
              id: b.id ?? '',
              buildNumber: b.buildNumber ?? null,
              status: b.buildStatus ?? '',
              startTime: b.startTime?.toISOString() ?? null,
              endTime: b.endTime?.toISOString() ?? null,
              initiator: b.initiator ?? null,
              sourceVersion: b.sourceVersion ?? null,
              resolvedSourceVersion: b.resolvedSourceVersion ?? null,
              phases: (b.phases ?? []).map(ph => ({
                name: ph.phaseType ?? '',
                status: ph.phaseStatus ?? '',
                durationSeconds: ph.durationInSeconds ?? null,
              })),
            }));
            return res.json({builds});
          } catch (err: any) {
            logger.error('AWS CodeBuild builds error:', err);
            return res.status(500).json({error: err.message ?? 'CodeBuild builds API error'});
          }
        });

        // ── CodePipeline ───────────────────────────────────────────────────────

        router.get('/codepipeline/:id', async (req, res) => {
          const row = await db(TABLE).where({id: req.params.id}).first();
          if (!row) return res.status(404).json({error: 'Config not found'});

          const cp = new AWS.CodePipeline({region: region(row), credentials: makeCredentials(row)});
          try {
            const listResult = await cp.listPipelines().promise();
            const pipelines = listResult.pipelines ?? [];
            if (pipelines.length === 0) return res.json({totalPipelines: 0, pipelines: []});

            const pipelineData = await Promise.all(pipelines.map(async p => {
              try {
                const stateResp = await cp.getPipelineState({name: p.name!}).promise();
                const stages = (stateResp.stageStates ?? []).map(s => ({
                  name: s.stageName ?? '',
                  status: s.latestExecution?.status ?? 'NotStarted',
                  lastChangedAt: (s.actionStates ?? []).map(a => a.latestExecution?.lastStatusChange?.getTime() ?? 0).reduce((a, b) => Math.max(a, b), 0) > 0
                    ? new Date((s.actionStates ?? []).map(a => a.latestExecution?.lastStatusChange?.getTime() ?? 0).reduce((a, b) => Math.max(a, b), 0)).toISOString()
                    : null,
                  actions: (s.actionStates ?? []).map(a => ({
                    name: a.actionName ?? '',
                    status: a.latestExecution?.status ?? 'NotStarted',
                    lastStatusChange: a.latestExecution?.lastStatusChange?.toISOString() ?? null,
                    externalExecutionUrl: a.latestExecution?.externalExecutionUrl ?? null,
                    errorDetails: a.latestExecution?.errorDetails?.message ?? null,
                  })),
                }));
                // Latest execution summary
                let latestExecution: any = null;
                try {
                  const execResp = await cp.listPipelineExecutions({pipelineName: p.name!, maxResults: 1}).promise();
                  const exec = execResp.pipelineExecutionSummaries?.[0];
                  if (exec) {
                    latestExecution = {
                      status: exec.status ?? '',
                      startTime: exec.startTime?.toISOString() ?? null,
                      lastUpdateTime: exec.lastUpdateTime?.toISOString() ?? null,
                      trigger: exec.trigger?.triggerType ?? null,
                    };
                  }
                } catch (_) { /* ignore */ }
                return {
                  name: p.name ?? '',
                  version: p.version ?? 1,
                  created: p.created?.toISOString() ?? null,
                  updated: p.updated?.toISOString() ?? null,
                  stages,
                  latestExecution,
                };
              } catch (_) {
                return {name: p.name ?? '', version: p.version ?? 1, created: null, updated: null, stages: [], latestExecution: null};
              }
            }));
            return res.json({totalPipelines: pipelineData.length, pipelines: pipelineData});
          } catch (err: any) {
            logger.error('AWS CodePipeline error:', err);
            return res.status(500).json({error: err.message ?? 'CodePipeline API error'});
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
