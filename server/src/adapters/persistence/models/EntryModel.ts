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
 * Mongoose schema for journal entries.
 *
 * Core ledger fields + audit metadata. The `intelligence` subdocument (AI enrichment) is
 * layered on in the next commit, deliberately kept as a separate nested schema so the
 * transactional core stays decoupled from expensive analytical data.
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
