import type { Request, Response, NextFunction } from 'express';
import { z, type ZodTypeAny } from 'zod';
import type { EntryService } from '../../application/EntryService.js';
import { ValidationError } from '../../application/errors.js';
import {
  createEntrySchema,
  updateCoreSchema,
  auditMetadataSchema,
  listQuerySchema,
} from './validation.js';

/**
 * Inbound HTTP adapter. Validates/parses requests with Zod, delegates to EntryService,
 * and shapes responses. Holds no business logic itself.
 */
export class EntryController {
  constructor(private readonly entries: EntryService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = parse(listQuerySchema, req.query);
      res.json(await this.entries.list(query));
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json(await this.entries.getById(req.params.id));
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = parse(createEntrySchema, req.body);
      const entry = await this.entries.create(body);
      res.status(201).json(entry);
    } catch (err) {
      next(err);
    }
  };

  updateCore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = parse(updateCoreSchema, req.body);
      res.json(await this.entries.updateCore(req.params.id, body));
    } catch (err) {
      next(err);
    }
  };

  updateAuditMetadata = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = parse(auditMetadataSchema, req.body);
      res.json(await this.entries.updateAuditMetadata(req.params.id, body));
    } catch (err) {
      next(err);
    }
  };
}

function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError('Request validation failed', result.error.flatten());
  }
  return result.data;
}
