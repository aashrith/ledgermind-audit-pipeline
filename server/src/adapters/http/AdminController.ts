import type { Request, Response, NextFunction } from 'express';
import type { ModelMigrationService } from '../../application/ModelMigrationService.js';
import type { ComplianceReevaluationService } from '../../application/ComplianceReevaluationService.js';

/**
 * Admin HTTP triggers — optional alternatives to the CLI scripts. Same services, invoked
 * over HTTP for convenience during a demo.
 */
export class AdminController {
  constructor(
    private readonly migration: ModelMigrationService,
    private readonly reevaluation: ComplianceReevaluationService,
    private readonly config: { modelVersion: string; batchSize: number },
  ) {}

  modelMigration = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.migration.migrate(this.config.modelVersion, this.config.batchSize);
      res.json({ ok: true, ...result });
    } catch (err) {
      next(err);
    }
  };

  riskReevaluation = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.reevaluation.reevaluate(this.config.batchSize);
      res.json({ ok: true, ...result });
    } catch (err) {
      next(err);
    }
  };
}
