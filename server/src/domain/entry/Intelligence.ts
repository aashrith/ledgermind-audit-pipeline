/**
 * Domain contract for the *analytical / AI enrichment* layer of a journal entry.
 *
 * Deliberately separate from the core ledger contract (`EntryCore`). This is the
 * expensive, asynchronously-computed data: risk scores, anomalies, and multi-space
 * vectors. It is written by the enrichment worker, never on the create path.
 */

export type Severity = 'low' | 'medium' | 'high';

export type IntelligenceStatus =
  | 'pending' // queued, not yet processed
  | 'processing' // claimed by a worker
  | 'completed' // enrichment succeeded
  | 'failed' // exhausted retries
  | 'stale'; // core field changed; awaiting recomputation

/** Why intelligence was invalidated, for observability. */
export type StaleReason =
  | 'core_changed'
  | 'model_migration'
  | 'risk_reevaluation'
  | null;

// ── Granular anomaly detection ──
export type AnomalyType =
  | 'numeric_outlier'
  | 'semantic_anomaly'
  | 'balance_mismatch'
  | 'temporal_anomaly'
  | 'missing_required_field'
  | 'gl_pattern_anomaly';

export interface Anomaly {
  type: AnomalyType;
  field: string;
  severity: Severity;
  message: string;
  detectedAt: Date;
}

// ── Compliance ──
export interface ComplianceFlag {
  code: string;
  message: string;
  severity: Severity;
}

/** One explainable contribution to the overall risk score (deterministic mock logic). */
export interface RiskFactor {
  code: string;
  detail: string;
  contribution: number; // additive weight applied to the score
}

// ── Multi-space vectors ──
export type VectorSpace = 'semantic' | 'financial' | 'entity';

export const VECTOR_SPACES: readonly VectorSpace[] = ['semantic', 'financial', 'entity'];

/** Fixed dimensionality for every mock embedding space. */
export const VECTOR_DIM = 16;

export interface Vectors {
  semantic: number[];
  financial: number[];
  entity: number[];
}

export interface Intelligence {
  status: IntelligenceStatus;
  modelVersion: string | null; // null until first enrichment
  riskVersion: string | null;

  riskScore: number; // 0.0 – 1.0
  severity: Severity;
  riskFactors: RiskFactor[]; // explainability for the score

  complianceFlags: ComplianceFlag[];
  anomalies: Anomaly[];

  vectors: Vectors | null; // null until first enrichment completes

  enrichedAt: Date | null;
  staleReason: StaleReason;
  processingAttempt: number;
  lastError: string | null;
}
