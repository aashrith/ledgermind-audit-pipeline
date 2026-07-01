import express, { type Express } from 'express';
import cors from 'cors';
import type { Server } from 'node:http';
import type { EntryController } from './EntryController.js';
import type { HealthController } from './HealthController.js';
import type { AdminController } from './AdminController.js';
import { buildRouter } from './routes.js';
import { errorMiddleware, notFoundMiddleware } from './errorMiddleware.js';

/** Builds and owns the Express application lifecycle. */
export class HttpServer {
  private readonly app: Express;
  private server: Server | null = null;

  constructor(entry: EntryController, health: HealthController, admin: AdminController) {
    this.app = express();
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use('/api', buildRouter(entry, health, admin));
    this.app.use(notFoundMiddleware);
    this.app.use(errorMiddleware);
  }

  get instance(): Express {
    return this.app;
  }

  start(port: number): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        console.log(`[http] API listening on :${port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve, reject) =>
      this.server!.close((err) => (err ? reject(err) : resolve())),
    );
    this.server = null;
  }
}
