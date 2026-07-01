/**
 * End-to-end integration test of the async pipeline against an in-memory MongoDB.
 * Run with: npm run test:integration
 *
 * Requires downloading a mongod binary on first run (mongodb-memory-server). If your
 * platform needs a pinned version, set e.g. MONGOMS_VERSION=7.0.14.
 */
import assert from 'node:assert';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { Config } from '../src/config/Config.js';
import { Database } from '../src/adapters/persistence/Database.js';
import { createContainer } from '../src/bootstrap.js';
import { EnrichmentWorker } from '../src/worker/EnrichmentWorker.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const mem = await MongoMemoryServer.create();
process.env.MONGODB_URI = mem.getUri('ledgermind');
process.env.MODEL_VERSION = 'v1';
process.env.RISK_VERSION = 'v1';
process.env.WORKER_ENRICH_DELAY_MS = '50';
process.env.WORKER_POLL_INTERVAL_MS = '80';

const config = Config.load();
const db = new Database(config);
await db.connect();
const c = createContainer(config);

const companyId = new mongoose.Types.ObjectId().toHexString();
const userId = new mongoose.Types.ObjectId().toHexString();

const created = await c.entryService.create({
  postingDate: new Date('2026-06-21T02:30:00.000Z'),
  transactionType: 'Journal Entry',
  entryNo: 'JE-SMOKE-1',
  name: 'ABC Traders Pvt Ltd',
  description: 'Manual adjustment reversal urgent',
  amount: 5_000_000,
  debit: 5_000_000,
  credit: 1_000_000,
  currency: 'INR',
  glNumber: 'XX',
  postingBy: 'user_8392',
  companyId,
  userId,
  sourceId: 'upload_91',
  uploadId: 'file_22',
  systemCreated: false,
  uploadSourceType: 1,
});
assert.equal(created.intelligence.status, 'pending', 'Scenario A: create must not block on enrichment');
console.log('✓ Scenario A: persisted with status=pending (enrichment is async)');

const worker = new EnrichmentWorker(c.queueService, c.enrichmentService, {
  workerId: 'test',
  pollIntervalMs: 80,
  enrichDelayMs: 50,
  maxAttempts: 3,
});
void worker.start();
await sleep(600);

let got = await c.entryService.getById(created.id);
assert.equal(got.intelligence.status, 'completed', 'worker completes enrichment');
assert.ok(got.intelligence.vectors && got.intelligence.vectors.semantic.length === 16, 'vectors generated');
assert.equal(got.intelligence.severity, 'high', 'high severity for risky entry');
assert.ok(got.intelligence.anomalies.length >= 4, 'multiple anomalies');
console.log(`✓ worker enriched: risk=${got.intelligence.riskScore} severity=${got.intelligence.severity}`);
const vectorsBefore = JSON.stringify(got.intelligence.vectors);
const enrichedAt = String(got.intelligence.enrichedAt);

// Scenario E — metadata-only must not disturb intelligence.
await c.entryService.updateAuditMetadata(created.id, { status: 'in_review' });
got = await c.entryService.getById(created.id);
assert.equal(got.intelligence.status, 'completed', 'metadata update must not mark stale');
assert.equal(String(got.intelligence.enrichedAt), enrichedAt, 'enrichedAt unchanged');
assert.equal(got.auditMetadata.status, 'in_review', 'audit status applied');
console.log('✓ Scenario E: metadata-only update bypassed enrichment');

// Scenario B — core analytical change marks stale + recomputes.
await c.entryService.updateCore(created.id, { amount: 200 });
got = await c.entryService.getById(created.id);
assert.equal(got.intelligence.status, 'stale', 'core change marks stale');
assert.equal(got.intelligence.staleReason, 'core_changed', 'staleReason set');
console.log('✓ Scenario B: core change marked stale + enqueued recomputation');

await sleep(600);
got = await c.entryService.getById(created.id);
assert.equal(got.intelligence.status, 'completed', 're-enrichment completes');
assert.notEqual(JSON.stringify(got.intelligence.vectors), vectorsBefore, 'vectors changed with financial fields');
console.log(`✓ re-enriched after edit: risk=${got.intelligence.riskScore} severity=${got.intelligence.severity}`);

// Scenario D — risk-only reevaluation leaves vectors untouched.
const vectorsPreReeval = JSON.stringify((await c.entryService.getById(created.id)).intelligence.vectors);
const reeval = await c.complianceReevaluationService.reevaluate(10);
assert.ok(reeval.updated >= 1, 'reevaluation should update at least one entry');
got = await c.entryService.getById(created.id);
assert.equal(got.intelligence.status, 'completed', 'reevaluation keeps status completed');
assert.equal(JSON.stringify(got.intelligence.vectors), vectorsPreReeval, 'vectors must be untouched by reevaluation');
console.log(`✓ Scenario D: reevaluated ${reeval.updated} entries, vectors preserved`);

// Scenario C — migrating to a new model version marks entries stale + enqueues.
const migration = await c.modelMigrationService.migrate('v2', 10);
assert.ok(migration.enqueued >= 1, 'migration should enqueue at least one recompute');
got = await c.entryService.getById(created.id);
assert.equal(got.intelligence.status, 'stale', 'migration marks stale');
assert.equal(got.intelligence.staleReason, 'model_migration', 'staleReason=model_migration');
console.log(`✓ Scenario C: migration enqueued ${migration.enqueued} recomputation(s)`);

console.log('✓ queue counts:', JSON.stringify(await c.queueService.counts()));

worker.stop();
await sleep(200);
await db.disconnect();
await mem.stop();
console.log('\nINTEGRATION TESTS PASSED ✅');
process.exit(0);
