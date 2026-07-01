import { Config } from '../config/Config.js';
import { Database } from '../adapters/persistence/Database.js';
import { createContainer } from '../bootstrap.js';
import { EntryModel } from '../adapters/persistence/models/EntryModel.js';
import { QueueJobModel } from '../adapters/persistence/models/QueueJobModel.js';
import { buildSeedEntries } from './seedData.js';

/**
 * Seed script — `npm run seed`.
 *
 * Clears the collections, inserts the demo journal entries, and enqueues a 'created'
 * enrichment job for each (Scenario A). By default the entries are left pending so you can
 * watch the worker enrich them live; pass `--enrich` (or SEED_ENRICH=true) to also run
 * enrichment inline for instant demo data.
 */
async function main(): Promise<void> {
  const config = Config.load();
  const database = new Database(config);
  await database.connect();

  const inlineEnrich = process.argv.includes('--enrich') || process.env.SEED_ENRICH === 'true';

  console.log('[seed] clearing existing entries + queue…');
  await Promise.all([EntryModel.deleteMany({}), QueueJobModel.deleteMany({})]);

  const container = createContainer(config);
  const specs = buildSeedEntries();

  let created = 0;
  const ids: string[] = [];
  for (const spec of specs) {
    const e = await container.entryService.create(spec);
    ids.push(e.id);
    created += 1;
  }
  console.log(`[seed] inserted ${created} entries and enqueued ${created} enrichment jobs`);

  if (inlineEnrich) {
    console.log('[seed] --enrich: running enrichment inline…');
    let enriched = 0;
    for (const id of ids) {
      await container.enrichmentService.enrich(id);
      enriched += 1;
    }
    // Drain the jobs we just satisfied so the queue reflects reality.
    await QueueJobModel.updateMany(
      { status: 'pending' },
      { $set: { status: 'completed', lockedAt: null, lockedBy: null } },
    );
    console.log(`[seed] enriched ${enriched} entries inline`);
  } else {
    console.log('[seed] run `npm run start:worker` to enrich the pending entries');
  }

  await database.disconnect();
  console.log('[seed] done ✅');
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
