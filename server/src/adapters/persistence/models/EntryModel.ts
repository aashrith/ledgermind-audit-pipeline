import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

/**
 * Audit workflow metadata — human review state, kept separate from the AI pipeline.
 * Mutated only by metadata-only updates (Scenario E); never by enrichment workers.
 */
const auditCommentSchema = new Schema(
  {
    by: { type: String, required: true },
    text: { type: String, required: true },
    at: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false },
);

const auditMetadataSchema = new Schema(
  {
    status: {
      type: String,
      enum: ['open', 'in_review', 'approved', 'rejected'],
      default: 'open',
    },
    comments: { type: [auditCommentSchema], default: [] },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
  },
  { _id: false },
);

/**
 * Intelligence (AI enrichment) — the analytical layer. Written asynchronously by the
 * enrichment worker via targeted $set, never on the create path. Kept as a separate
 * nested schema so the transactional core never gets rewritten by enrichment.
 */
const anomalySchema = new Schema(
  {
    type: {
      type: String,
      enum: [
        'numeric_outlier',
        'semantic_anomaly',
        'balance_mismatch',
        'temporal_anomaly',
        'missing_required_field',
        'gl_pattern_anomaly',
      ],
      required: true,
    },
    field: { type: String, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high'], required: true },
    message: { type: String, required: true },
    detectedAt: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false },
);

const complianceFlagSchema = new Schema(
  {
    code: { type: String, required: true },
    message: { type: String, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high'], required: true },
  },
  { _id: false },
);

const riskFactorSchema = new Schema(
  {
    code: { type: String, required: true },
    detail: { type: String, required: true },
    contribution: { type: Number, required: true },
  },
  { _id: false },
);

const vectorsSchema = new Schema(
  {
    semantic: { type: [Number], default: undefined },
    financial: { type: [Number], default: undefined },
    entity: { type: [Number], default: undefined },
  },
  { _id: false },
);

const intelligenceSchema = new Schema(
  {
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'stale'],
      default: 'pending',
      index: true,
    },
    modelVersion: { type: String, default: null },
    riskVersion: { type: String, default: null },

    riskScore: { type: Number, min: 0, max: 1, default: 0 },
    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'low', index: true },
    riskFactors: { type: [riskFactorSchema], default: [] },

    complianceFlags: { type: [complianceFlagSchema], default: [] },
    anomalies: { type: [anomalySchema], default: [] },

    vectors: { type: vectorsSchema, default: null },

    enrichedAt: { type: Date, default: null },
    staleReason: {
      type: String,
      enum: ['core_changed', 'model_migration', 'risk_reevaluation', null],
      default: null,
    },
    processingAttempt: { type: Number, default: 0 },
    lastError: { type: String, default: null },
  },
  { _id: false },
);

/**
 * Mongoose schema for journal entries.
 *
 * Core ledger fields + audit metadata + intelligence — three cleanly separated layers.
 * The transactional core and the analytical layer live in distinct nested schemas so
 * expensive enrichment is always a targeted subdocument update, never a root rewrite.
 */
const entrySchema = new Schema(
  {
    // ── core ledger fields (transactional substance) ──
    postingDate: { type: Date, required: true, index: true },
    transactionType: { type: String, required: true, default: 'Journal Entry' },
    entryNo: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    amount: { type: Number, required: true },
    debit: { type: Number, required: true, default: 0 },
    credit: { type: Number, required: true, default: 0 },
    currency: { type: String, required: true, default: 'INR' },
    glNumber: { type: String, default: '' },
    postingBy: { type: String, required: true },
    companyId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    sourceId: { type: String, default: '' },
    uploadId: { type: String, default: '' },
    systemCreated: { type: Boolean, default: false },
    uploadSourceType: { type: Number, default: 0 },

    // ── audit workflow metadata (human review; metadata-only updates) ──
    auditMetadata: { type: auditMetadataSchema, default: () => ({}) },

    // ── intelligence (AI enrichment; async, targeted $set only) ──
    intelligence: { type: intelligenceSchema, default: () => ({}) },

    // ── bookkeeping ──
    version: { type: Number, required: true, default: 0 },
  },
  {
    // map Mongoose timestamps onto the spec's `created` / `updated` field names
    timestamps: { createdAt: 'created', updatedAt: 'updated' },
    // we manage our own optimistic `version` counter; disable the default __v
    versionKey: false,
    collection: 'entries',
  },
);

export type EntrySchemaType = InferSchemaType<typeof entrySchema>;
export type EntryDocument = HydratedDocument<EntrySchemaType>;

export const EntryModel = model('Entry', entrySchema);
