import type { IQueueService } from '../ports/IQueueService.js';
import type { EnrichmentService } from '../application/EnrichmentService.js';

export interface WorkerConfig {
  workerId: string;
  pollIntervalMs: number;
  enrichDelayMs: number;
  maxAttempts: number;
}

/**
 * Class-based background worker that drains the MongoDB queue.
 *
 * Each tick atomically claims one job (pending → processing), simulates ML latency, runs
 * the enrichment pass, and resolves the job. Because claiming is atomic at the queue
 * layer, multiple worker processes can run safely without double-processing a job.
 */
export class EnrichmentWorker {
  private running = false;
  private idle: Promise<void> | null = null;

  constructor(
    private readonly queue: IQueueService,
    private readonly enrichment: EnrichmentService,
    private readonly config: WorkerConfig,
  ) {}

  /** Begin the poll loop. Resolves only once stop() is called and the loop drains. */
  async start(): Promise<void> {
    this.running = true;
    console.log(`[worker:${this.config.workerId}] started — polling every ${this.config.pollIntervalMs}ms`);
    this.idle = this.loop();
    await this.idle;
  }

  stop(): void {
    console.log(`[worker:${this.config.workerId}] stop requested`);
    this.running = false;
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        const job = await this.queue.claimNext(this.config.workerId);
        if (!job) {
          await sleep(this.config.pollIntervalMs);
          continue;
        }
        await this.process(job.id, job.entryId, job.reason, job.attempts);
      } catch (err) {
        console.error(`[worker:${this.config.workerId}] loop error:`, (err as Error).message);
        await sleep(this.config.pollIntervalMs);
      }
    }
    console.log(`[worker:${this.config.workerId}] loop drained`);
  }

  private async process(
    jobId: string,
    entryId: string,
    reason: string,
    attempt: number,
  ): Promise<void> {
    const started = Date.now();
    console.log(`[worker:${this.config.workerId}] ▶ claimed job ${jobId} (entry ${entryId}, reason=${reason}, attempt=${attempt})`);

    try {
      // Simulate ML model latency.
      await sleep(this.config.enrichDelayMs);
      await this.enrichment.enrich(entryId);
      await this.queue.complete(jobId);
      console.log(`[worker:${this.config.workerId}] ✔ enriched entry ${entryId} in ${Date.now() - started}ms`);
    } catch (err) {
      const message = (err as Error).message;
      await this.queue.fail(jobId, message, this.config.maxAttempts);
      console.error(`[worker:${this.config.workerId}] ✘ job ${jobId} failed: ${message}`);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
