import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

/**
 * Mongoose schema for journal entries.
 *
 * Phase 2 — core ledger fields only. The `auditMetadata` and `intelligence` subdocuments
 * are layered on in subsequent commits, deliberately kept as separate nested schemas so
 * the transactional core stays decoupled from expensive analytical data.
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
