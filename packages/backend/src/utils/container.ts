import { Container } from 'inversify';
import { pool, WorkerPool } from 'workerpool';
import { POOL } from '../keys';

const container = new Container();
container.bind<WorkerPool>(POOL).toConstantValue(
  pool('./src/workers/index.js', {
    workerType: 'process',
  }),
);

export { container };
