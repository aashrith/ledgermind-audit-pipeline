import type { EntryCore } from '../entry/Entry.js';

/**
 * Shared, deterministic signal predicates over a journal entry's core fields.
 *
 * These encode the explainable "mock ML" heuristics once, so the risk scorer, anomaly
 * detector, and compliance evaluator all reason from the same primitives.
 */

export const RISK_RULES = {
  /** Amounts above this are treated as unusually high. */
  highAmountThreshold: 1_000_000,
  /** Words that hint at manual intervention / override behaviour. */
  suspiciousWords: ['adjustment', 'manual', 'reversal', 'urgent', 'override'],
  /** A well-formed GL account number is exactly six digits. */
  glPattern: /^\d{6}$/,
  /** Hour-of-day below this (local) counts as an unusual late-night posting. */
  lateNightBeforeHour: 6,
} as const;

export function isUnbalanced(e: Pick<EntryCore, 'amount' | 'debit' | 'credit'>): boolean {
  const onlyDebit = e.debit === e.amount && e.credit === 0;
  const onlyCredit = e.credit === e.amount && e.debit === 0;
  return !(onlyDebit || onlyCredit);
}

export function isHighAmount(amount: number): boolean {
  return Math.abs(amount) > RISK_RULES.highAmountThreshold;
}

export interface TemporalSignal {
  weekend: boolean;
  lateNight: boolean;
}

export function temporalSignal(postingDate: Date): TemporalSignal {
  const day = postingDate.getUTCDay(); // 0 = Sun, 6 = Sat
  const hour = postingDate.getUTCHours();
  return {
    weekend: day === 0 || day === 6,
    lateNight: hour < RISK_RULES.lateNightBeforeHour,
  };
}

export function suspiciousWordsIn(description: string): string[] {
  const text = (description ?? '').toLowerCase();
  return RISK_RULES.suspiciousWords.filter((w) => text.includes(w));
}

export function isDescriptionMissing(description: string): boolean {
  return !description || description.trim().length === 0;
}

export function glIssue(glNumber: string): 'missing' | 'malformed' | null {
  if (!glNumber || glNumber.trim().length === 0) return 'missing';
  if (!RISK_RULES.glPattern.test(glNumber)) return 'malformed';
  return null;
}
