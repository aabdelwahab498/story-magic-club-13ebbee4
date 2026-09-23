import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerModule } from './worker.module.js';

async function bootstrapWorker() {
  process.env.IS_WORKER = 'true';
  const logger = new Logger('NajmahWorker');
  const app = await NestFactory.createApplicationContext(WorkerModule);
  logger.log('Najmah Worker Process started and listening to BullMQ queues...');

  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received. Shutting down worker process...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.log('SIGINT received. Shutting down worker process...');
    await app.close();
    process.exit(0);
  });
}

void bootstrapWorker();
