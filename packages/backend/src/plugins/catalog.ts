import {CatalogBuilder} from '@backstage/plugin-catalog-backend';
import {ScaffolderEntitiesProcessor} from '@backstage/plugin-scaffolder-backend';
// import {GithubOrgEntityProvider, GithubOrgReaderProcessor} from "@backstage/plugin-catalog-backend-module-github";
import {GithubMultiOrgEntityProvider, GithubOrgReaderProcessor} from "@backstage/plugin-catalog-backend-module-github";

import {Router} from 'express';
import {PluginEnvironment} from '../types';

export default async function createPlugin(
    env: PluginEnvironment,
): Promise<Router> {
    const builder = await CatalogBuilder.create(env);
    builder.addProcessor(new ScaffolderEntitiesProcessor());
    builder.addProcessor(
        GithubOrgReaderProcessor.fromConfig(env.config, {logger: env.logger}),
    );
    const githubIngtigrationConfig: any = env.config.get('integrations.github');
    // The org URL below needs to match a configured integrations.github entry
    // specified in your app-config.
    const gitProvider = GithubMultiOrgEntityProvider.fromConfig(env.config, {
        id: 'production',
        githubUrl: 'https://github.com',
        orgs: githubIngtigrationConfig[0].orgs,
        logger: env.logger,
        // schedule: env.scheduler.createScheduledTaskRunner({
        //     frequency: {minutes: 120}, // TODO: inject from config
        //     timeout: {minutes: 15}, // TODO: inject from config
        // }),
    });
    builder.addEntityProvider(gitProvider as GithubMultiOrgEntityProvider);
    // builder.addEntityProvider(
    //     GithubEntityProvider.fromConfig(env.config, {
    //         logger: env.logger,
    //         // optional: alternatively, use scheduler with schedule defined in app-config.yaml
    //         schedule: env.scheduler.createScheduledTaskRunner({
    //             frequency: { minutes: 1440 },
    //             timeout: { minutes: 3 },
    //         }),
    //         // optional: alternatively, use schedule
    //         scheduler: env.scheduler,
    //     }),
    // );

    const {processingEngine, router} = await builder.build();
    await processingEngine.start();
    const githubSyncEnv = process.env.ENABLE_GITHUB_SYNC;
    if (githubSyncEnv && !['0', 'false', 'no', 'n', ''].includes(githubSyncEnv.toLowerCase())) {
        await gitProvider.read();
    }
    return router;
}
