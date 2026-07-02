import type { Request, Response, NextFunction } from 'express';

/**
 * Per-request timeout guard. If a request outlives the bound, respond 503 and fail clean
 * rather than leaking a long-tail latency / hung connection.
 */
export class RequestTimeout {
  constructor(private readonly ms: number) {}

  middleware = (_req: Request, res: Response, next: NextFunction): void => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(503).json({
          error: { code: 'TIMEOUT', message: 'Request exceeded time budget' },
        });
      }
    }, this.ms);

    const clear = (): void => clearTimeout(timer);
    res.on('finish', clear);
    res.on('close', clear);
    next();
  };
}
