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
