import { Types } from 'mongoose';
import { QueueJobModel, type QueueJobDocument } from '../persistence/models/QueueJobModel.js';
import type { IQueueService } from '../../ports/IQueueService.js';
import {
  buildIdempotencyKey,
  type EnqueueJobInput,
  type QueueJob,
} from '../../domain/queue/QueueJob.js';

const MONGO_DUPLICATE_KEY = 11000;

/**
 * MongoDB-backed job queue implementing IQueueService.
 *
 * Race-condition mitigation: `claimNext` flips a job pending → processing with a single
 * atomic findOneAndUpdate and stamps lockedAt/lockedBy, so concurrent workers can never
 * claim the same job. `enqueue` relies on the unique partial index for idempotency.
 */
export class MongoQueueService implements IQueueService {
  async enqueue(input: EnqueueJobInput): Promise<QueueJob | null> {
    const idempotencyKey = buildIdempotencyKey(input.entryId, input.reason, input.modelVersion);
    try {
      const doc = await QueueJobModel.create({
        type: 'ENRICH_ENTRY',
        entryId: new Types.ObjectId(input.entryId),
        status: 'pending',
        reason: input.reason,
        attempts: 0,
        idempotencyKey,
      });
      return toDomain(doc);
    } catch (err: unknown) {
      // Duplicate active job for this key → already queued, treat as no-op success.
      if (isDuplicateKeyError(err)) return null;
      throw err;
    }
  }

  /** Atomically claim the oldest pending job (pending → processing). */
  async claimNext(workerId: string): Promise<QueueJob | null> {
    const doc = await QueueJobModel.findOneAndUpdate(
      { status: 'pending' },
      {
        $set: { status: 'processing', lockedAt: new Date(), lockedBy: workerId },
        $inc: { attempts: 1 },
      },
      { sort: { createdAt: 1 }, new: true },
    );
    return doc ? toDomain(doc) : null;
  }

  async complete(jobId: string): Promise<void> {
    await QueueJobModel.updateOne(
      { _id: jobId },
      { $set: { status: 'completed', error: null, lockedAt: null, lockedBy: null } },
    );
  }

  /** Requeue while attempts remain, otherwise mark failed. */
  async fail(jobId: string, error: string, maxAttempts: number): Promise<void> {
    const job = await QueueJobModel.findById(jobId);
    if (!job) return;

    if (job.attempts < maxAttempts) {
      await QueueJobModel.updateOne(
        { _id: jobId },
        { $set: { status: 'pending', error, lockedAt: null, lockedBy: null } },
      );
    } else {
      await QueueJobModel.updateOne(
        { _id: jobId },
        { $set: { status: 'failed', error, lockedAt: null, lockedBy: null } },
      );
    }
  }

  async counts(): Promise<Record<QueueJob['status'], number>> {
    const rows = await QueueJobModel.aggregate<{ _id: QueueJob['status']; n: number }>([
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]);
    const result: Record<QueueJob['status'], number> = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };
    for (const row of rows) result[row._id] = row.n;
    return result;
  }

  async pendingDepth(): Promise<number> {
    return QueueJobModel.countDocuments({ status: 'pending' });
  }

  async reclaimStale(lockTtlMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - lockTtlMs);
    const res = await QueueJobModel.updateMany(
      { status: 'processing', lockedAt: { $lt: cutoff } },
      { $set: { status: 'pending', lockedAt: null, lockedBy: null } },
    );
    return res.modifiedCount ?? 0;
  }
}

function toDomain(doc: QueueJobDocument): QueueJob {
  return {
    id: doc._id.toString(),
    type: doc.type,
    entryId: doc.entryId.toString(),
    status: doc.status,
    reason: doc.reason,
    attempts: doc.attempts,
    lockedAt: doc.lockedAt ?? null,
    lockedBy: doc.lockedBy ?? null,
    idempotencyKey: doc.idempotencyKey,
    error: doc.error ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: number }).code === MONGO_DUPLICATE_KEY
  );
}
