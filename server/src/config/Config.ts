import { z } from 'zod';

/**
 * Strongly-typed, validated application configuration.
 *
 * Environment parsing happens exactly once, at the boundary, via Zod — so the rest of
 * the codebase consumes a typed `Config` instance and never touches `process.env`.
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  MODEL_VERSION: z.string().default('v1'),
  RISK_VERSION: z.string().default('v1'),

  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
  WORKER_ENRICH_DELAY_MS: z.coerce.number().int().nonnegative().default(400),
  WORKER_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  WORKER_ID: z.string().default('worker-local'),

  BATCH_SIZE: z.coerce.number().int().positive().default(100),

  // ── predictability / bounded-work controls ──
  MONGO_MAX_POOL_SIZE: z.coerce.number().int().positive().default(20),
  MONGO_SERVER_SELECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(10000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),

  // Admission control on the enrichment path (NOT the ledger write).
  MAX_QUEUE_DEPTH: z.coerce.number().int().positive().default(5000),
  QUEUE_DEPTH_TTL_MS: z.coerce.number().int().nonnegative().default(1000),

  // Sweeper + stale-job reaper.
  SWEEPER_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  SWEEPER_BATCH: z.coerce.number().int().positive().default(100),
  JOB_LOCK_TTL_MS: z.coerce.number().int().positive().default(60000),

  // Similarity candidate ceiling (bounded fan-out).
  SIMILARITY_CANDIDATE_LIMIT: z.coerce.number().int().positive().default(1000),
});

export type Env = z.infer<typeof envSchema>;

export class Config {
  private static instance: Config | null = null;

  readonly port: number;
  readonly nodeEnv: Env['NODE_ENV'];
  readonly mongoUri: string;
  readonly modelVersion: string;
  readonly riskVersion: string;
  readonly worker: {
    pollIntervalMs: number;
    enrichDelayMs: number;
    maxAttempts: number;
    id: string;
  };
  readonly batchSize: number;
  readonly mongo: {
    maxPoolSize: number;
    serverSelectionTimeoutMs: number;
  };
  readonly rateLimit: {
    windowMs: number;
    max: number;
  };
  readonly requestTimeoutMs: number;
  readonly admission: {
    maxQueueDepth: number;
    depthTtlMs: number;
  };
  readonly sweeper: {
    intervalMs: number;
    batch: number;
    jobLockTtlMs: number;
  };
  readonly similarityCandidateLimit: number;

  private constructor(env: Env) {
    this.port = env.PORT;
    this.nodeEnv = env.NODE_ENV;
    this.mongoUri = env.MONGODB_URI;
    this.modelVersion = env.MODEL_VERSION;
    this.riskVersion = env.RISK_VERSION;
    this.worker = {
      pollIntervalMs: env.WORKER_POLL_INTERVAL_MS,
      enrichDelayMs: env.WORKER_ENRICH_DELAY_MS,
      maxAttempts: env.WORKER_MAX_ATTEMPTS,
      id: env.WORKER_ID,
    };
    this.batchSize = env.BATCH_SIZE;
    this.mongo = {
      maxPoolSize: env.MONGO_MAX_POOL_SIZE,
      serverSelectionTimeoutMs: env.MONGO_SERVER_SELECTION_TIMEOUT_MS,
    };
    this.rateLimit = { windowMs: env.RATE_LIMIT_WINDOW_MS, max: env.RATE_LIMIT_MAX };
    this.requestTimeoutMs = env.REQUEST_TIMEOUT_MS;
    this.admission = {
      maxQueueDepth: env.MAX_QUEUE_DEPTH,
      depthTtlMs: env.QUEUE_DEPTH_TTL_MS,
    };
    this.sweeper = {
      intervalMs: env.SWEEPER_INTERVAL_MS,
      batch: env.SWEEPER_BATCH,
      jobLockTtlMs: env.JOB_LOCK_TTL_MS,
    };
    this.similarityCandidateLimit = env.SIMILARITY_CANDIDATE_LIMIT;
  }

  /** Parse and validate `process.env`, failing fast with a readable error. */
  static load(source: NodeJS.ProcessEnv = process.env): Config {
    if (Config.instance) return Config.instance;

    const parsed = envSchema.safeParse(source);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('\n');
      throw new Error(`Invalid environment configuration:\n${issues}`);
    }

    Config.instance = new Config(parsed.data);
    return Config.instance;
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }
}
