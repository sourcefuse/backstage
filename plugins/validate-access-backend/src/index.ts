import { createRouter } from './service/router';
import { PluginEnvironment } from './types';

export default async function createPlugin(env: PluginEnvironment) {
  return await createRouter({
    logger: env.logger,
  });
}
