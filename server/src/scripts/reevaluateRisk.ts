import { Config } from '../config/Config.js';
import { Database } from '../adapters/persistence/Database.js';
import { createContainer } from '../bootstrap.js';

/**
 * Risk / compliance reevaluation CLI — `npm run reevaluate:risk`.
 *
 * Recomputes only risk score, severity, anomalies, and compliance flags via targeted
 * $set, in memory-safe cursor batches. Vectors and model version are left untouched —
 * this is the cheap path for a regulatory rule shift (Scenario D).
 */
async function main(): Promise<void> {
  const config = Config.load();
  const database = new Database(config);
  await database.connect();

  const container = createContainer(config);
  await container.complianceReevaluationService.reevaluate(config.batchSize);

  await database.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('[reevaluate:risk] failed:', err);
  process.exit(1);
});
