import type { EnqueueJobInput, QueueJob } from '../domain/queue/QueueJob.js';

/**
 * Outbound port for the asynchronous job queue (hexagonal seam).
 *
 * The HTTP layer enqueues; the worker claims and resolves. The concrete adapter
 * (`MongoQueueService`) backs this with MongoDB and atomic findOneAndUpdate claiming, but
 * the contract is broker-agnostic — it could be swapped for BullMQ without touching
 * callers.
 */
export interface IQueueService {
  /**
   * Enqueue a job. Returns null if an active job with the same idempotency key already
   * exists (deduped) — callers should treat that as a no-op success.
   */
  enqueue(input: EnqueueJobInput): Promise<QueueJob | null>;

  /**
   * Atomically claim the oldest pending job: flips status pending → processing and stamps
   * lockedAt/lockedBy in one findOneAndUpdate. Returns null when the queue is empty.
   */
  claimNext(workerId: string): Promise<QueueJob | null>;

  /** Mark a claimed job completed. */
  complete(jobId: string): Promise<void>;

  /**
   * Record a failure. If attempts remain below the max, the job is requeued (status back
   * to pending, lock released); otherwise it is marked failed.
   */
  fail(jobId: string, error: string, maxAttempts: number): Promise<void>;

  /** Queue depth by status, for health/observability. */
  counts(): Promise<Record<QueueJob['status'], number>>;

  /** Number of pending (not-yet-claimed) jobs — cheap, index-backed; for admission control. */
  pendingDepth(): Promise<number>;

  /**
   * Reclaim jobs stuck in `processing` past the lock TTL (worker crashed mid-job): reset
   * them to `pending` and release the lock. Returns how many were reclaimed.
   */
  reclaimStale(lockTtlMs: number): Promise<number>;
}
