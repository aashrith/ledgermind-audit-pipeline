import type { IEntryRepository } from '../ports/IEntryRepository.js';
import type { Entry } from '../domain/entry/Entry.js';
import type { Intelligence } from '../domain/entry/Intelligence.js';
import { RiskScoringService } from '../domain/intelligence/RiskScoringService.js';
import { AnomalyDetectionService } from '../domain/intelligence/AnomalyDetectionService.js';
import { ComplianceService } from '../domain/intelligence/ComplianceService.js';
import { VectorService } from '../domain/intelligence/VectorService.js';
import { NotFoundError } from './errors.js';

export interface EnrichmentVersions {
  modelVersion: string;
  riskVersion: string;
}

/**
 * Orchestrates the domain intelligence services into one enrichment pass and persists the
 * result with a single targeted write. Used by the worker (Scenario A/B) and migrations.
 */
export class EnrichmentService {
  constructor(
    private readonly repo: IEntryRepository,
    private readonly risk: RiskScoringService,
    private readonly anomaly: AnomalyDetectionService,
    private readonly compliance: ComplianceService,
    private readonly vector: VectorService,
    private readonly versions: EnrichmentVersions,
  ) {}

  /** Full enrichment: risk + anomalies + compliance + vectors. */
  async enrich(entryId: string): Promise<void> {
    const entry = await this.repo.findById(entryId);
    if (!entry) throw new NotFoundError(`Entry ${entryId} not found`);

    const { riskScore, severity, riskFactors } = this.risk.assess(entry);
    const anomalies = this.anomaly.detect(entry);
    const complianceFlags = this.compliance.evaluate(entry, riskScore);
    const vectors = this.vector.generate(entry);

    const intelligence: Partial<Intelligence> = {
      status: 'completed',
      modelVersion: this.versions.modelVersion,
      riskVersion: this.versions.riskVersion,
      riskScore,
      severity,
      riskFactors,
      complianceFlags,
      anomalies,
      vectors,
      enrichedAt: new Date(),
      staleReason: null,
      lastError: null,
    };

    await this.repo.setIntelligence(entryId, intelligence);
  }

  /**
   * Risk/compliance-only recomputation (Scenario D): recomputes score, severity,
   * anomalies, and compliance flags but deliberately leaves vectors untouched.
   */
  async reevaluateRiskOnly(entry: Entry): Promise<void> {
    const { riskScore, severity, riskFactors } = this.risk.assess(entry);
    const anomalies = this.anomaly.detect(entry);
    const complianceFlags = this.compliance.evaluate(entry, riskScore);

    await this.repo.setIntelligence(entry.id, {
      status: 'completed',
      riskVersion: this.versions.riskVersion,
      riskScore,
      severity,
      riskFactors,
      complianceFlags,
      anomalies,
      staleReason: null,
      // NOTE: vectors and modelVersion intentionally omitted — embeddings stay valid.
    });
  }
}
