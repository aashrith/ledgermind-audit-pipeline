import { Types, type FilterQuery } from 'mongoose';
import { EntryModel, type EntrySchemaType } from './models/EntryModel.js';
import { EntryMapper } from './EntryMapper.js';
import type {
  IEntryRepository,
  EntryQuery,
  Paginated,
} from '../../ports/IEntryRepository.js';
import type { Entry, EntryCreateInput, AuditMetadata } from '../../domain/entry/Entry.js';
import type { Intelligence } from '../../domain/entry/Intelligence.js';

/**
 * MongoDB adapter implementing the IEntryRepository port.
 *
 * Every mutation uses targeted update operators ($set / $inc) scoped to the exact
 * sub-paths involved — the root document is never rewritten, so enrichment writes never
 * clobber core ledger fields and vice-versa.
 */
export class MongoEntryRepository implements IEntryRepository {
  async create(input: EntryCreateInput): Promise<Entry> {
    const doc = await EntryModel.create({ ...input, version: 0 });
    return EntryMapper.toDomain(doc);
  }

  async findById(id: string): Promise<Entry | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await EntryModel.findById(id);
    return doc ? EntryMapper.toDomain(doc) : null;
  }

  async findMany(query: EntryQuery): Promise<Paginated<Entry>> {
    const filter: FilterQuery<EntrySchemaType> = {};
    if (query.severity) filter['intelligence.severity'] = query.severity;
    if (query.status) filter['intelligence.status'] = query.status;
    if (query.search) {
      const rx = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ entryNo: rx }, { description: rx }, { name: rx }];
    }

    const page = Math.max(1, query.page);
    const pageSize = Math.min(100, Math.max(1, query.pageSize));

    const [docs, total] = await Promise.all([
      EntryModel.find(filter)
        .sort({ postingDate: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize),
      EntryModel.countDocuments(filter),
    ]);

    return { items: docs.map(EntryMapper.toDomain), total, page, pageSize };
  }

  /** Replace core ledger fields and bump the optimistic version, guarded by expectedVersion. */
  async updateCore(
    id: string,
    patch: Partial<EntryCreateInput>,
    expectedVersion: number,
  ): Promise<Entry | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await EntryModel.findOneAndUpdate(
      { _id: id, version: expectedVersion },
      { $set: patch, $inc: { version: 1 } },
      { new: true },
    );
    return doc ? EntryMapper.toDomain(doc) : null;
  }

  /** Metadata-only update (Scenario E): atomic $set on auditMetadata sub-paths only. */
  async updateAuditMetadata(
    id: string,
    patch: Partial<AuditMetadata>,
  ): Promise<Entry | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const set: Record<string, unknown> = {};
    if (patch.status !== undefined) set['auditMetadata.status'] = patch.status;
    if (patch.comments !== undefined) set['auditMetadata.comments'] = patch.comments;
    if (patch.reviewedBy !== undefined) set['auditMetadata.reviewedBy'] = patch.reviewedBy;
    if (patch.reviewedAt !== undefined) set['auditMetadata.reviewedAt'] = patch.reviewedAt;

    const doc = await EntryModel.findByIdAndUpdate(id, { $set: set }, { new: true });
    return doc ? EntryMapper.toDomain(doc) : null;
  }

  /** Targeted write of computed intelligence (worker path) — only provided sub-paths. */
  async setIntelligence(id: string, intelligence: Partial<Intelligence>): Promise<void> {
    if (!Types.ObjectId.isValid(id)) return;
    const set: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(intelligence)) {
      set[`intelligence.${key}`] = value;
    }
    await EntryModel.updateOne({ _id: id }, { $set: set });
  }

  async markIntelligenceStale(
    id: string,
    reason: NonNullable<Intelligence['staleReason']>,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(id)) return;
    await EntryModel.updateOne(
      { _id: id },
      { $set: { 'intelligence.status': 'stale', 'intelligence.staleReason': reason } },
    );
  }

  /**
   * Memory-safe async iterator backed by a Mongo cursor. Yields fixed-size batches so
   * migrations never load the whole collection into memory (Scenario C/D backpressure).
   */
  async *iterate(
    batchSize: number,
    filter?: Partial<Pick<Intelligence, 'modelVersion'>>,
  ): AsyncIterable<Entry[]> {
    const mongoFilter: FilterQuery<EntrySchemaType> = {};
    if (filter?.modelVersion !== undefined) {
      mongoFilter['intelligence.modelVersion'] = filter.modelVersion;
    }

    const cursor = EntryModel.find(mongoFilter).sort({ _id: 1 }).batchSize(batchSize).cursor();
    let batch: Entry[] = [];
    for await (const doc of cursor) {
      batch.push(EntryMapper.toDomain(doc));
      if (batch.length >= batchSize) {
        yield batch;
        batch = [];
      }
    }
    if (batch.length > 0) yield batch;
  }
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
