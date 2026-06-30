import type { EntryCore } from '../entry/Entry.js';
import type { RiskFactor, Severity } from '../entry/Intelligence.js';
import {
  isUnbalanced,
  isHighAmount,
  temporalSignal,
  suspiciousWordsIn,
  glIssue,
  isDescriptionMissing,
} from './signals.js';

export interface RiskAssessment {
  riskScore: number; // 0.0 – 1.0
  severity: Severity;
  riskFactors: RiskFactor[];
}

/**
 * Context-aware risk scoring (Scenario / Feature 1).
 *
 * Deterministic, explainable mock logic: each triggered rule contributes an additive,
 * named weight, and the factors travel with the score so the UI can render *why* an entry
 * scored as it did. No randomness — same entry always yields the same score.
 */
export class RiskScoringService {
  private static readonly WEIGHTS = {
    unbalanced: 0.3,
    highAmount: 0.25,
    weekend: 0.1,
    lateNight: 0.15,
    suspiciousWord: 0.12,
    glMissing: 0.18,
    glMalformed: 0.1,
    descriptionMissing: 0.1,
  } as const;

  assess(entry: EntryCore): RiskAssessment {
    const factors: RiskFactor[] = [];

    if (isUnbalanced(entry)) {
      factors.push({
        code: 'BALANCE',
        detail: `debit (${entry.debit}) and credit (${entry.credit}) do not balance against amount (${entry.amount})`,
        contribution: RiskScoringService.WEIGHTS.unbalanced,
      });
    }

    if (isHighAmount(entry.amount)) {
      factors.push({
        code: 'HIGH_AMOUNT',
        detail: `amount ${entry.amount} exceeds the high-value threshold`,
        contribution: RiskScoringService.WEIGHTS.highAmount,
      });
    }

    const { weekend, lateNight } = temporalSignal(entry.postingDate);
    if (weekend) {
      factors.push({
        code: 'TEMPORAL_WEEKEND',
        detail: 'entry posted on a weekend',
        contribution: RiskScoringService.WEIGHTS.weekend,
      });
    }
    if (lateNight) {
      factors.push({
        code: 'TEMPORAL_LATE_NIGHT',
        detail: 'entry posted during unusual late-night hours',
        contribution: RiskScoringService.WEIGHTS.lateNight,
      });
    }

    const suspicious = suspiciousWordsIn(entry.description);
    if (suspicious.length > 0) {
      factors.push({
        code: 'SEMANTIC',
        detail: `description contains suspicious term(s): ${suspicious.join(', ')}`,
        contribution: Math.min(
          0.24,
          suspicious.length * RiskScoringService.WEIGHTS.suspiciousWord,
        ),
      });
    }

    const gl = glIssue(entry.glNumber);
    if (gl === 'missing') {
      factors.push({
        code: 'GL_MISSING',
        detail: 'GL account number is missing',
        contribution: RiskScoringService.WEIGHTS.glMissing,
      });
    } else if (gl === 'malformed') {
      factors.push({
        code: 'GL_MALFORMED',
        detail: `GL number "${entry.glNumber}" is not a valid 6-digit account`,
        contribution: RiskScoringService.WEIGHTS.glMalformed,
      });
    }

    if (isDescriptionMissing(entry.description)) {
      factors.push({
        code: 'DESCRIPTION_MISSING',
        detail: 'entry has no description',
        contribution: RiskScoringService.WEIGHTS.descriptionMissing,
      });
    }

    const raw = factors.reduce((sum, f) => sum + f.contribution, 0);
    const riskScore = Math.min(1, Number(raw.toFixed(4)));

    return { riskScore, severity: RiskScoringService.toSeverity(riskScore), riskFactors: factors };
  }

  static toSeverity(score: number): Severity {
    if (score >= 0.67) return 'high';
    if (score >= 0.34) return 'medium';
    return 'low';
  }
}
