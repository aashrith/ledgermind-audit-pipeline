import { Config } from '../config/Config.js';
import { Database } from '../adapters/persistence/Database.js';
import { createContainer } from '../bootstrap.js';
import { EnrichmentWorker } from './EnrichmentWorker.js';
import { EnrichmentSweeper } from './EnrichmentSweeper.js';

/** Worker entrypoint — `npm run start:worker`. Polls the queue and enriches entries. */
async function main(): Promise<void> {
  const config = Config.load();
  const database = new Database(config);
  await database.connect();

  const container = createContainer(config);
  const worker = new EnrichmentWorker(container.queueService, container.enrichmentService, {
    workerId: config.worker.id,
    pollIntervalMs: config.worker.pollIntervalMs,
    enrichDelayMs: config.worker.enrichDelayMs,
    maxAttempts: config.worker.maxAttempts,
  });

  const sweeper = new EnrichmentSweeper(container.entryRepository, container.queueService, {
    intervalMs: config.sweeper.intervalMs,
    batch: config.sweeper.batch,
    jobLockTtlMs: config.sweeper.jobLockTtlMs,
    modelVersion: config.modelVersion,
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[worker] received ${signal}, draining…`);
    sweeper.stop();
    worker.stop();
    await database.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  sweeper.start();
  await worker.start();
}

main().catch((err) => {
  console.error('[worker] fatal startup error:', err);
  process.exit(1);
});
