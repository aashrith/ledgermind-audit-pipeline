import { Config } from './config/Config.js';
import { Database } from './adapters/persistence/Database.js';
import { createContainer } from './bootstrap.js';
import { EntryController } from './adapters/http/EntryController.js';
import { HealthController } from './adapters/http/HealthController.js';
import { AdminController } from './adapters/http/AdminController.js';
import { HttpServer } from './adapters/http/HttpServer.js';

/** Server entrypoint — boots MongoDB, wires the container, and starts the API. */
async function main(): Promise<void> {
  const config = Config.load();
  const database = new Database(config);
  await database.connect();

  const container = createContainer(config);

  const httpServer = new HttpServer(
    new EntryController(container.entryService, container.similaritySearchService),
    new HealthController(database, container.queueService),
    new AdminController(container.modelMigrationService, container.complianceReevaluationService, {
      modelVersion: config.modelVersion,
      batchSize: config.batchSize,
    }),
  );
  await httpServer.start(config.port);

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[server] received ${signal}, shutting down…`);
    await httpServer.stop();
    await database.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[server] fatal startup error:', err);
  process.exit(1);
});
