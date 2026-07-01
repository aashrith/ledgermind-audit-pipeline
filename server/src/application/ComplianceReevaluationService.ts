import type { IEntryRepository } from '../ports/IEntryRepository.js';
import type { EnrichmentService } from './EnrichmentService.js';

export interface ReevaluationResult {
  scanned: number;
  updated: number;
  skipped: number;
  batches: number;
}

/**
 * Regulatory / compliance rule shift (Scenario D).
 *
 * When risk thresholds or compliance rules change, the expensive vectors remain valid.
 * This walks the collection in cursor batches and recomputes ONLY risk score, severity,
 * anomalies, and compliance flags via targeted $set — vectors are never touched and no
 * enrichment worker is involved. Runs synchronously, memory-safe.
 */
export class ComplianceReevaluationService {
  constructor(
    private readonly repo: IEntryRepository,
    private readonly enrichment: EnrichmentService,
  ) {}

  async reevaluate(batchSize: number): Promise<ReevaluationResult> {
    const result: ReevaluationResult = { scanned: 0, updated: 0, skipped: 0, batches: 0 };

    console.log(`[reevaluate:risk] batchSize=${batchSize}`);

    for await (const batch of this.repo.iterate(batchSize)) {
      result.batches += 1;
      for (const entry of batch) {
        result.scanned += 1;
        // Only entries that already have vectors (were enriched) can be risk-only updated.
        if (!entry.intelligence.vectors) {
          result.skipped += 1;
          continue;
        }
        await this.enrichment.reevaluateRiskOnly(entry);
        result.updated += 1;
      }
      console.log(
        `[reevaluate:risk] batch ${result.batches}: scanned=${result.scanned} updated=${result.updated} skipped=${result.skipped}`,
      );
    }

    console.log(
      `[reevaluate:risk] complete — scanned=${result.scanned} updated=${result.updated} skipped=${result.skipped} over ${result.batches} batch(es)`,
    );
    return result;
  }
}
