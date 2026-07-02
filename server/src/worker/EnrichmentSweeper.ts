import type { IEntryRepository } from '../ports/IEntryRepository.js';
import type { IQueueService } from '../ports/IQueueService.js';

export interface SweeperConfig {
  intervalMs: number;
  batch: number;
  jobLockTtlMs: number;
  modelVersion: string;
}

/**
 * Background maintenance loop that keeps the queue self-healing and bounded:
 *
 * 1. **Reaper** — reclaims jobs stuck in `processing` past the lock TTL (crashed worker),
 *    returning them to `pending` so they get retried.
 * 2. **Sweeper** — re-enqueues entries still `pending` (deferred by admission control, or
 *    orphaned by a crash between the ledger write and enqueue). Idempotent enqueue means
 *    entries that already have an active job are no-ops.
 *
 * Both operate in fixed-size, bounded batches and self-reschedule (no overlap), so their
 * cost per tick is known ahead of time.
 */
export class EnrichmentSweeper {
  private running = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly repo: IEntryRepository,
    private readonly queue: IQueueService,
    private readonly config: SweeperConfig,
  ) {}

  start(): void {
    this.running = true;
    console.log(
      `[sweeper] started — interval=${this.config.intervalMs}ms batch=${this.config.batch} lockTtl=${this.config.jobLockTtlMs}ms`,
    );
    this.schedule();
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    console.log('[sweeper] stopped');
  }

  private schedule(): void {
    this.timer = setTimeout(() => void this.tick(), this.config.intervalMs);
  }

  private async tick(): Promise<void> {
    if (!this.running) return;
    try {
      const reclaimed = await this.queue.reclaimStale(this.config.jobLockTtlMs);

      const pendingIds = await this.repo.findPendingEntryIds(this.config.batch);
      let enqueued = 0;
      for (const entryId of pendingIds) {
        const job = await this.queue.enqueue({
          entryId,
          reason: 'created',
          modelVersion: this.config.modelVersion,
        });
        if (job) enqueued += 1;
      }

      if (reclaimed > 0 || enqueued > 0) {
        console.log(`[sweeper] reclaimed=${reclaimed} enqueued=${enqueued}`);
      }
    } catch (err) {
      console.error('[sweeper] tick error:', (err as Error).message);
    }
    if (this.running) this.schedule();
  }
}
