import { Config } from '../config/Config.js';
import { Database } from '../adapters/persistence/Database.js';
import { createContainer } from '../bootstrap.js';

/**
 * Model migration CLI — `npm run migrate:models`.
 *
 * Marks entries below the target model version stale and enqueues recomputation, using
 * memory-safe cursor batches. Target version = MODEL_VERSION (set this to the new version,
 * e.g. MODEL_VERSION=v2, and run the worker to re-enrich).
 */
async function main(): Promise<void> {
  const config = Config.load();
  const database = new Database(config);
  await database.connect();

  const container = createContainer(config);
  await container.modelMigrationService.migrate(config.modelVersion, config.batchSize);

  await database.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('[migrate:models] failed:', err);
  process.exit(1);
});
