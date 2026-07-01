import type { IEntryRepository } from '../ports/IEntryRepository.js';
import type { IQueueService } from '../ports/IQueueService.js';

export interface MigrationResult {
  scanned: number;
  enqueued: number;
  skipped: number;
  batches: number;
}

/**
 * System model upgrade (Scenario C).
 *
 * Walks the entire collection via a cursor in fixed-size batches — never loading it all
 * into memory — and for every entry not already on the target model version, marks its
 * intelligence stale and enqueues a full recomputation. The worker then re-enriches with
 * the new model. Memory-safe and restartable (idempotent enqueue dedupes).
 */
export class ModelMigrationService {
  constructor(
    private readonly repo: IEntryRepository,
    private readonly queue: IQueueService,
  ) {}

  async migrate(targetModelVersion: string, batchSize: number): Promise<MigrationResult> {
    const result: MigrationResult = { scanned: 0, enqueued: 0, skipped: 0, batches: 0 };

    console.log(`[migrate:models] target=${targetModelVersion} batchSize=${batchSize}`);

    for await (const batch of this.repo.iterate(batchSize)) {
      result.batches += 1;
      for (const entry of batch) {
        result.scanned += 1;
        if (entry.intelligence.modelVersion === targetModelVersion) {
          result.skipped += 1;
          continue;
        }
        await this.repo.markIntelligenceStale(entry.id, 'model_migration');
        const job = await this.queue.enqueue({
          entryId: entry.id,
          reason: 'model_migration',
          modelVersion: targetModelVersion,
        });
        if (job) result.enqueued += 1;
      }
      console.log(
        `[migrate:models] batch ${result.batches}: scanned=${result.scanned} enqueued=${result.enqueued} skipped=${result.skipped}`,
      );
    }

    console.log(
      `[migrate:models] complete — scanned=${result.scanned} enqueued=${result.enqueued} skipped=${result.skipped} over ${result.batches} batch(es)`,
    );
    return result;
  }
}
