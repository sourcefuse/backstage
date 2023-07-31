import { Container } from 'inversify';
import { pool, WorkerPool } from 'workerpool';
import { POOL } from '../keys';
import { join } from 'path';
import { resolvePackagePath } from '@backstage/backend-common';

const container = new Container();
container.bind<WorkerPool>(POOL).toConstantValue(
  pool(join(resolvePackagePath('backend','src/workers/index.js')), {
    workerType: 'process',
  }),
);

export { container };
