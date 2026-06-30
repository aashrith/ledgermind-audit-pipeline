/**
 * Domain contract for the MongoDB-backed job queue.
 *
 * A job represents one unit of asynchronous work (currently: enrich an entry). The queue
 * is intentionally Mongo-native — no external broker — so the whole pipeline runs with a
 * single dependency and claiming is done with atomic findOneAndUpdate.
 */

export type JobType = 'ENRICH_ENTRY';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** Why the job was enqueued — drives logging and downstream behaviour. */
export type JobReason =
  | 'created' // Scenario A: new entry
  | 'core_changed' // Scenario B: analytical core field edited
  | 'model_migration' // Scenario C: model version bump
  | 'risk_reevaluation'; // Scenario D: risk/compliance-only recompute

export interface QueueJob {
  id: string;
  type: JobType;
  entryId: string;
  status: JobStatus;
  reason: JobReason;

  attempts: number;

  // ── atomic-claim / race-condition mitigation ──
  lockedAt: Date | null;
  lockedBy: string | null;

  /**
   * Idempotency guard: `entryId:reason:modelVersion`. Prevents enqueuing a duplicate job
   * for work that is already pending/processing for the same target + model.
   */
  idempotencyKey: string;

  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type EnqueueJobInput = Pick<QueueJob, 'entryId' | 'reason'> & {
  modelVersion: string;
};

export function buildIdempotencyKey(
  entryId: string,
  reason: JobReason,
  modelVersion: string,
): string {
  return `${entryId}:${reason}:${modelVersion}`;
}
