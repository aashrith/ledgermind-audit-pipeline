import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

/**
 * Mongoose schema for the MongoDB-backed job queue.
 *
 * Claiming is atomic: a worker flips status `pending → processing` with findOneAndUpdate
 * and stamps lockedAt/lockedBy in the same operation, so two workers can never grab the
 * same job. The unique partial index on idempotencyKey (active jobs only) stops duplicate
 * enqueues for the same entry+reason+model.
 */
const queueJobSchema = new Schema(
  {
    type: { type: String, enum: ['ENRICH_ENTRY'], required: true, default: 'ENRICH_ENTRY' },
    entryId: { type: Schema.Types.ObjectId, ref: 'Entry', required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    reason: {
      type: String,
      enum: ['created', 'core_changed', 'model_migration', 'risk_reevaluation'],
      required: true,
    },

    attempts: { type: Number, default: 0 },

    // ── atomic-claim / race-condition mitigation ──
    lockedAt: { type: Date, default: null },
    lockedBy: { type: String, default: null },

    idempotencyKey: { type: String, required: true },

    error: { type: String, default: null },
  },
  {
    timestamps: true, // createdAt / updatedAt
    versionKey: false,
    collection: 'queue_jobs',
  },
);

// Fast claim scan: oldest pending job first.
queueJobSchema.index({ status: 1, createdAt: 1 });

// Idempotency: at most one *active* (pending/processing) job per key.
queueJobSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'processing'] } },
  },
);

export type QueueJobSchemaType = InferSchemaType<typeof queueJobSchema>;
export type QueueJobDocument = HydratedDocument<QueueJobSchemaType>;

export const QueueJobModel = model('QueueJob', queueJobSchema);
