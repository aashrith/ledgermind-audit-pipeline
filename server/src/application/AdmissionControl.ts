import type { IQueueService } from '../ports/IQueueService.js';

/**
 * Admission control for the enrichment path.
 *
 * When the pending backlog exceeds a known ceiling, new enrichment work is *not* admitted
 * immediately — the ledger write still succeeds, but the entry is left pending for the
 * sweeper to drain when capacity frees. This is what keeps the system in its stable mode
 * under load instead of admitting unbounded work and sliding into collapse.
 *
 * The depth read is TTL-cached so the hot create path pays at most one cheap count per
 * window, not one per request (a bounded, predictable cost).
 */
export class AdmissionControl {
  private cachedDepth = 0;
  private cachedAt = 0;

  constructor(
    private readonly queue: IQueueService,
    private readonly maxQueueDepth: number,
    private readonly ttlMs: number,
  ) {}

  async canAdmit(): Promise<boolean> {
    const now = Date.now();
    if (now - this.cachedAt >= this.ttlMs) {
      this.cachedDepth = await this.queue.pendingDepth();
      this.cachedAt = now;
    }
    return this.cachedDepth < this.maxQueueDepth;
  }
}
