import type { Entry, EntryCreateInput, AuditMetadata } from '../domain/entry/Entry.js';
import type { Intelligence, Severity, IntelligenceStatus } from '../domain/entry/Intelligence.js';
import type { SimilarityCandidate } from '../domain/entry/Similarity.js';

/** Filtering + pagination contract for the dashboard list endpoint. */
export interface EntryQuery {
  page: number;
  pageSize: number;
  severity?: Severity;
  status?: IntelligenceStatus;
  /** Free-text match against entryNo or description. */
  search?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Outbound port for entry persistence (hexagonal seam).
 *
 * The application/services layer depends on THIS interface, not on Mongoose. The concrete
 * `MongoEntryRepository` adapter implements it using targeted update operators ($set,
 * $unset, $inc) so enrichment never rewrites the whole document.
 */
export interface IEntryRepository {
  create(input: EntryCreateInput): Promise<Entry>;

  findById(id: string): Promise<Entry | null>;

  findMany(query: EntryQuery): Promise<Paginated<Entry>>;

  /** Replace core ledger fields and bump the optimistic version ($set + $inc). */
  updateCore(
    id: string,
    patch: Partial<EntryCreateInput>,
    expectedVersion: number,
  ): Promise<Entry | null>;

  /** Metadata-only update (Scenario E): atomic $set, no enrichment side effects. */
  updateAuditMetadata(id: string, patch: Partial<AuditMetadata>): Promise<Entry | null>;

  /** Targeted write of computed intelligence (worker path). */
  setIntelligence(id: string, intelligence: Partial<Intelligence>): Promise<void>;

  /** Mark intelligence stale without touching vectors or core fields. */
  markIntelligenceStale(id: string, reason: NonNullable<Intelligence['staleReason']>): Promise<void>;

  /**
   * Memory-safe async iterator over entries for batch migrations (Scenario C/D).
   * Implemented with a Mongo cursor — never loads the full collection into memory.
   */
  iterate(batchSize: number, filter?: Partial<Pick<Intelligence, 'modelVersion'>>): AsyncIterable<Entry[]>;

  /**
   * Lightweight projection of enriched entries (completed, vectors present) for similarity
   * ranking, excluding the query entry. Bounded by `limit` to cap memory.
   */
  findSimilarityCandidates(excludeId: string, limit: number): Promise<SimilarityCandidate[]>;

  /**
   * IDs of entries whose intelligence is still `pending` (bounded by `limit`). Used by the
   * sweeper to (re)enqueue enrichment for entries deferred by admission control or orphaned
   * by a crash between create and enqueue.
   */
  findPendingEntryIds(limit: number): Promise<string[]>;
}
