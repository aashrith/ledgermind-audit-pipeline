import type { Request, Response, NextFunction } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * In-memory fixed-window rate limiter (ingress protection).
 *
 * Fails fast with 429 rather than letting excess traffic degrade tail latency. Bounded
 * memory: expired buckets are pruned. Per-instance only — for a multi-node deployment this
 * would move to Redis, but the middleware contract stays the same.
 */
export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly windowMs: number,
    private readonly max: number,
  ) {}

  middleware = (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();

    let bucket = this.buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;

    res.setHeader('X-RateLimit-Limit', this.max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, this.max - bucket.count));

    if (bucket.count > this.max) {
      res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Too many requests — slow down' },
      });
      return;
    }

    if (this.buckets.size > 10_000) this.prune(now);
    next();
  };

  private prune(now: number): void {
    for (const [key, b] of this.buckets) {
      if (now >= b.resetAt) this.buckets.delete(key);
    }
  }
}
