import { z } from 'zod';

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'must be a 24-char hex ObjectId');

/** POST /api/entries — full core ledger payload. */
export const createEntrySchema = z.object({
  postingDate: z.coerce.date(),
  transactionType: z.string().min(1).default('Journal Entry'),
  entryNo: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  amount: z.number(),
  debit: z.number().nonnegative().default(0),
  credit: z.number().nonnegative().default(0),
  currency: z.string().min(1).default('INR'),
  glNumber: z.string().default(''),
  postingBy: z.string().min(1),
  companyId: objectId,
  userId: objectId,
  sourceId: z.string().default(''),
  uploadId: z.string().default(''),
  systemCreated: z.boolean().default(false),
  uploadSourceType: z.number().int().default(0),
});

/** PUT /api/entries/:id — partial core update (only mutable ledger fields). */
export const updateCoreSchema = z
  .object({
    postingDate: z.coerce.date(),
    transactionType: z.string().min(1),
    name: z.string().min(1),
    description: z.string(),
    amount: z.number(),
    debit: z.number().nonnegative(),
    credit: z.number().nonnegative(),
    currency: z.string().min(1),
    glNumber: z.string(),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'at least one field is required' });

/** PATCH /api/entries/:id/audit-metadata — metadata only. */
export const auditMetadataSchema = z
  .object({
    status: z.enum(['open', 'in_review', 'approved', 'rejected']),
    comments: z
      .array(z.object({ by: z.string(), text: z.string(), at: z.coerce.date().optional() }))
      .transform((arr) => arr.map((c) => ({ ...c, at: c.at ?? new Date() }))),
    reviewedBy: z.string(),
    reviewedAt: z.coerce.date(),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'at least one field is required' });

/** POST /api/entries/search/similar — similarity query. */
export const similaritySearchSchema = z.object({
  entryId: objectId,
  strategy: z.enum(['semantic', 'financial', 'entity']),
  topK: z.coerce.number().int().positive().max(50).default(5),
});

/** GET /api/entries — list filters + pagination. */
export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  severity: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'stale']).optional(),
  search: z.string().trim().min(1).optional(),
});

export type CreateEntryBody = z.infer<typeof createEntrySchema>;
export type UpdateCoreBody = z.infer<typeof updateCoreSchema>;
export type AuditMetadataBody = z.infer<typeof auditMetadataSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
export type SimilaritySearchBody = z.infer<typeof similaritySearchSchema>;
