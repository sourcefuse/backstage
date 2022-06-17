import { Container } from 'inversify';
import { pool, WorkerPool } from 'workerpool';
import { POOL } from '../keys';
import { join } from 'path';

const container = new Container();
container.bind<WorkerPool>(POOL).toConstantValue(
  pool(join(__dirname, '../workers/index.js'), {
    workerType: 'process',
  }),
);

export { container };
