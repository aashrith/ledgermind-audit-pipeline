import type { EntryCore } from '../entry/Entry.js';
import type { Anomaly } from '../entry/Intelligence.js';
import {
  isUnbalanced,
  isHighAmount,
  temporalSignal,
  suspiciousWordsIn,
  glIssue,
  isDescriptionMissing,
} from './signals.js';

/**
 * Granular anomaly detection (Feature 2).
 *
 * Produces independent, field-level signal objects — each names the anomaly type, the
 * exact field involved, a severity, and a human message. Unlike the risk score (one
 * aggregate number), these are discrete findings the dashboard lists per entry.
 */
export class AnomalyDetectionService {
  detect(entry: EntryCore): Anomaly[] {
    const now = new Date();
    const anomalies: Anomaly[] = [];

    if (isUnbalanced(entry)) {
      anomalies.push({
        type: 'balance_mismatch',
        field: 'debit',
        severity: 'high',
        message: `Entry does not balance: debit=${entry.debit}, credit=${entry.credit}, amount=${entry.amount}`,
        detectedAt: now,
      });
    }

    if (isHighAmount(entry.amount)) {
      anomalies.push({
        type: 'numeric_outlier',
        field: 'amount',
        severity: 'medium',
        message: `Amount ${entry.amount} exceeds the configured high-value threshold`,
        detectedAt: now,
      });
    }

    const { weekend, lateNight } = temporalSignal(entry.postingDate);
    if (weekend || lateNight) {
      anomalies.push({
        type: 'temporal_anomaly',
        field: 'postingDate',
        severity: lateNight ? 'medium' : 'low',
        message: `Unusual posting time${weekend ? ' (weekend)' : ''}${lateNight ? ' (late night)' : ''}`,
        detectedAt: now,
      });
    }

    const suspicious = suspiciousWordsIn(entry.description);
    if (suspicious.length > 0) {
      anomalies.push({
        type: 'semantic_anomaly',
        field: 'description',
        severity: 'medium',
        message: `Description contains suspicious term(s): ${suspicious.join(', ')}`,
        detectedAt: now,
      });
    }

    if (isDescriptionMissing(entry.description)) {
      anomalies.push({
        type: 'missing_required_field',
        field: 'description',
        severity: 'low',
        message: 'Description is empty',
        detectedAt: now,
      });
    }

    const gl = glIssue(entry.glNumber);
    if (gl === 'missing') {
      anomalies.push({
        type: 'missing_required_field',
        field: 'glNumber',
        severity: 'medium',
        message: 'GL account number is missing',
        detectedAt: now,
      });
    } else if (gl === 'malformed') {
      anomalies.push({
        type: 'gl_pattern_anomaly',
        field: 'glNumber',
        severity: 'low',
        message: `GL number "${entry.glNumber}" does not match the expected 6-digit pattern`,
        detectedAt: now,
      });
    }

    return anomalies;
  }
}
