import mongoose from 'mongoose';
import type { Config } from '../../config/Config.js';

/**
 * Thin class wrapper around the Mongoose connection lifecycle.
 *
 * Centralizes connect/disconnect so the HTTP server, the worker, and the CLI scripts
 * all share one consistent bootstrap path.
 */
export class Database {
  private connected = false;

  constructor(private readonly config: Config) {}

  async connect(): Promise<typeof mongoose> {
    if (this.connected) return mongoose;

    mongoose.set('strictQuery', true);

    mongoose.connection.on('error', (err) => {
      console.error('[db] connection error:', err.message);
    });
    mongoose.connection.once('open', () => {
      console.log(`[db] connected → ${this.redactUri(this.config.mongoUri)}`);
    });

    // Bounded connection pool + fast-fail server selection: caps DB concurrency and
    // avoids long hangs when Mongo is the bottleneck (predictability under load).
    await mongoose.connect(this.config.mongoUri, {
      maxPoolSize: this.config.mongo.maxPoolSize,
      serverSelectionTimeoutMS: this.config.mongo.serverSelectionTimeoutMs,
    });
    this.connected = true;
    return mongoose;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    await mongoose.disconnect();
    this.connected = false;
    console.log('[db] disconnected');
  }

  get isConnected(): boolean {
    return this.connected && mongoose.connection.readyState === 1;
  }

  /** Hide credentials before logging a connection string. */
  private redactUri(uri: string): string {
    return uri.replace(/\/\/([^@]+)@/, '//***@');
  }
}
