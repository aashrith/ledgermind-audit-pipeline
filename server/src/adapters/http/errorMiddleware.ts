import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../application/errors.js';

/** Final Express error handler — maps AppError to its status, everything else to 500. */
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err instanceof Object && 'details' in err ? { details: (err as { details?: unknown }).details } : {}),
      },
    });
    return;
  }

  console.error('[http] unhandled error:', err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
}

/** 404 fallthrough for unmatched routes. */
export function notFoundMiddleware(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
}
