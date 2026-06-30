import type { EntryDocument } from './models/EntryModel.js';
import type { Entry } from '../../domain/entry/Entry.js';
import type { Intelligence } from '../../domain/entry/Intelligence.js';

/**
 * Translates a Mongoose `EntryDocument` into the framework-free domain `Entry`.
 * Keeping this in one place means services never see Mongoose types or ObjectIds.
 */
export class EntryMapper {
  static toDomain(doc: EntryDocument): Entry {
    const i = doc.intelligence;
    const intelligence: Intelligence = {
      status: i?.status ?? 'pending',
      modelVersion: i?.modelVersion ?? null,
      riskVersion: i?.riskVersion ?? null,
      riskScore: i?.riskScore ?? 0,
      severity: i?.severity ?? 'low',
      riskFactors: (i?.riskFactors ?? []).map((f) => ({
        code: f.code,
        detail: f.detail,
        contribution: f.contribution,
      })),
      complianceFlags: (i?.complianceFlags ?? []).map((c) => ({
        code: c.code,
        message: c.message,
        severity: c.severity,
      })),
      anomalies: (i?.anomalies ?? []).map((a) => ({
        type: a.type,
        field: a.field,
        severity: a.severity,
        message: a.message,
        detectedAt: a.detectedAt,
      })),
      vectors: i?.vectors
        ? {
            semantic: i.vectors.semantic ?? [],
            financial: i.vectors.financial ?? [],
            entity: i.vectors.entity ?? [],
          }
        : null,
      enrichedAt: i?.enrichedAt ?? null,
      staleReason: i?.staleReason ?? null,
      processingAttempt: i?.processingAttempt ?? 0,
      lastError: i?.lastError ?? null,
    };

    return {
      id: doc._id.toString(),
      postingDate: doc.postingDate,
      transactionType: doc.transactionType,
      entryNo: doc.entryNo,
      name: doc.name,
      description: doc.description,
      amount: doc.amount,
      debit: doc.debit,
      credit: doc.credit,
      currency: doc.currency,
      glNumber: doc.glNumber,
      postingBy: doc.postingBy,
      companyId: doc.companyId.toString(),
      userId: doc.userId.toString(),
      sourceId: doc.sourceId,
      uploadId: doc.uploadId,
      systemCreated: doc.systemCreated,
      uploadSourceType: doc.uploadSourceType,
      created: doc.created,
      updated: doc.updated,
      version: doc.version,
      auditMetadata: {
        status: doc.auditMetadata?.status ?? 'open',
        comments: (doc.auditMetadata?.comments ?? []).map((c) => ({
          by: c.by,
          text: c.text,
          at: c.at,
        })),
        reviewedBy: doc.auditMetadata?.reviewedBy ?? undefined,
        reviewedAt: doc.auditMetadata?.reviewedAt ?? undefined,
      },
      intelligence,
    };
  }
}
