import type { EntryCore } from '../entry/Entry.js';
import type { ComplianceFlag } from '../entry/Intelligence.js';
import { isUnbalanced, isHighAmount, glIssue } from './signals.js';

/**
 * Compliance / regulatory evaluation (Feature 4 inputs).
 *
 * Maps entry signals + the computed risk score onto named compliance flags. These rules
 * are the part that shifts in Scenario D — they can be recomputed without touching the
 * (still-valid) vectors.
 */
export class ComplianceService {
  private static readonly HIGH_RISK_THRESHOLD = 0.67;

  evaluate(entry: EntryCore, riskScore: number): ComplianceFlag[] {
    const flags: ComplianceFlag[] = [];

    if (isUnbalanced(entry)) {
      flags.push({
        code: 'DOUBLE_ENTRY_VIOLATION',
        message: 'Debits and credits do not balance (double-entry / IFRS violation)',
        severity: 'high',
      });
    }

    if (isHighAmount(entry.amount)) {
      flags.push({
        code: 'MATERIALITY_THRESHOLD',
        message: 'High-value entry exceeds materiality threshold; secondary approval required',
        severity: 'medium',
      });
    }

    if (glIssue(entry.glNumber) === 'missing') {
      flags.push({
        code: 'GL_ACCOUNT_REQUIRED',
        message: 'GL account number is required for ledger classification',
        severity: 'medium',
      });
    }

    if (riskScore >= ComplianceService.HIGH_RISK_THRESHOLD) {
      flags.push({
        code: 'HIGH_RISK_REVIEW',
        message: 'Risk score breaches the high-risk threshold; manual audit review required',
        severity: 'high',
      });
    }

    return flags;
  }
}
