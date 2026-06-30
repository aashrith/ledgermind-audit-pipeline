import type { Request, Response, NextFunction } from 'express';
import type { IQueueService } from '../../ports/IQueueService.js';
import type { Database } from '../persistence/Database.js';

/** GET /api/health — liveness + DB connectivity + queue depth. */
export class HealthController {
  constructor(
    private readonly db: Database,
    private readonly queue: IQueueService,
  ) {}

  health = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const queue = await this.queue.counts();
      res.json({
        status: 'ok',
        db: this.db.isConnected ? 'connected' : 'disconnected',
        queue,
        time: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  };
}
