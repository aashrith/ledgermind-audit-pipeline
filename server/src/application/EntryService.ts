import type { IEntryRepository, EntryQuery, Paginated } from '../ports/IEntryRepository.js';
import type { IQueueService } from '../ports/IQueueService.js';
import {
  CORE_ANALYTICAL_FIELDS,
  type Entry,
  type EntryCreateInput,
  type AuditMetadata,
} from '../domain/entry/Entry.js';
import type { AdmissionControl } from './AdmissionControl.js';
import { NotFoundError, ConflictError } from './errors.js';

export interface EntryServiceConfig {
  modelVersion: string;
}

/**
 * Application orchestration for journal entries. Encodes the operational scenarios:
 * - A: create persists immediately, then enqueues enrichment (never blocks).
 * - B: core-field edits mark intelligence stale + enqueue full recomputation.
 * - E: audit-metadata edits save atomically with NO enrichment side effects.
 */
export class EntryService {
  constructor(
    private readonly repo: IEntryRepository,
    private readonly queue: IQueueService,
    private readonly admission: AdmissionControl,
    private readonly config: EntryServiceConfig,
  ) {}

  /**
   * Scenario A — persist the baseline entry (always; the immutable ledger write is never
   * rejected), then admit enrichment only if the backlog is within bounds. Over the
   * ceiling, the entry stays `pending` and the sweeper drains it — the system sheds
   * enrichment instead of collapsing.
   */
  async create(input: EntryCreateInput): Promise<Entry> {
    const entry = await this.repo.create(input);
    if (await this.admission.canAdmit()) {
      await this.queue.enqueue({
        entryId: entry.id,
        reason: 'created',
        modelVersion: this.config.modelVersion,
      });
    } else {
      console.warn(
        `[admission] backlog at capacity — deferring enrichment for ${entry.id} (sweeper will drain)`,
      );
    }
    return entry;
  }

  async getById(id: string): Promise<Entry> {
    const entry = await this.repo.findById(id);
    if (!entry) throw new NotFoundError(`Entry ${id} not found`);
    return entry;
  }

  async list(query: EntryQuery): Promise<Paginated<Entry>> {
    return this.repo.findMany(query);
  }

  /**
   * Scenario B — update core ledger fields. If any *analytical* field changed, mark
   * intelligence stale and enqueue a full recomputation. Optimistic-locked on version.
   */
  async updateCore(id: string, patch: Partial<EntryCreateInput>): Promise<Entry> {
    const current = await this.repo.findById(id);
    if (!current) throw new NotFoundError(`Entry ${id} not found`);

    const analyticalChanged = this.didAnalyticalChange(current, patch);

    const updated = await this.repo.updateCore(id, patch, current.version);
    if (!updated) throw new ConflictError();

    if (analyticalChanged) {
      await this.repo.markIntelligenceStale(id, 'core_changed');
      await this.queue.enqueue({
        entryId: id,
        reason: 'core_changed',
        modelVersion: this.config.modelVersion,
      });
    }

    return (await this.repo.findById(id)) ?? updated;
  }

  /** Scenario E — metadata-only update. Atomic save, no enrichment, no staleness. */
  async updateAuditMetadata(id: string, patch: Partial<AuditMetadata>): Promise<Entry> {
    const updated = await this.repo.updateAuditMetadata(id, patch);
    if (!updated) throw new NotFoundError(`Entry ${id} not found`);
    return updated;
  }

  private didAnalyticalChange(current: Entry, patch: Partial<EntryCreateInput>): boolean {
    return CORE_ANALYTICAL_FIELDS.some((field) => {
      if (!(field in patch)) return false;
      const next = patch[field];
      if (next === undefined) return false;
      if (field === 'postingDate') {
        return new Date(next as Date).getTime() !== current.postingDate.getTime();
      }
      return next !== current[field];
    });
  }
}
