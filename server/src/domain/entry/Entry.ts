/**
 * Domain contract for a journal entry's *core ledger* fields.
 *
 * This is the immutable transactional substance of a General Ledger entry — the
 * low-latency record. Analytical/AI layers (audit metadata, intelligence) are kept in
 * separate contracts so expensive enrichment never forces a rewrite of these fields.
 *
 * Pure TypeScript: no Mongoose, no framework imports. The persistence adapter implements
 * this shape; ports and services depend on it.
 */
export interface EntryCore {
  postingDate: Date;
  transactionType: string;
  entryNo: string;
  name: string;
  description: string;
  amount: number;
  debit: number;
  credit: number;
  currency: string;
  glNumber: string;
  postingBy: string;
  companyId: string;
  userId: string;
  sourceId: string;
  uploadId: string;
  systemCreated: boolean;
  uploadSourceType: number;
}

/** Lifecycle/bookkeeping fields maintained by the persistence layer. */
export interface EntryTimestamps {
  created: Date;
  updated: Date;
  /** Optimistic-concurrency counter, bumped on every mutation. */
  version: number;
}

/** The full entry document shape grows as audit + intelligence layers are added. */
export interface Entry extends EntryCore, EntryTimestamps {
  id: string;
}

/** Fields an auditor may legitimately supply when creating a raw entry. */
export type EntryCreateInput = EntryCore;

/**
 * Core analytical fields. A change to any of these invalidates all previously computed
 * intelligence and must trigger a full recomputation (Scenario B).
 */
export const CORE_ANALYTICAL_FIELDS = [
  'amount',
  'description',
  'glNumber',
  'postingDate',
] as const satisfies ReadonlyArray<keyof EntryCore>;

export type CoreAnalyticalField = (typeof CORE_ANALYTICAL_FIELDS)[number];
