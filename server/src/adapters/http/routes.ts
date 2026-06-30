import { Router } from 'express';
import type { EntryController } from './EntryController.js';
import type { HealthController } from './HealthController.js';

/** Wires REST routes to controller methods. */
export function buildRouter(entry: EntryController, health: HealthController): Router {
  const router = Router();

  router.get('/health', health.health);

  router.get('/entries', entry.list);
  router.post('/entries', entry.create);
  router.get('/entries/:id', entry.getById);
  router.put('/entries/:id', entry.updateCore);
  router.patch('/entries/:id/audit-metadata', entry.updateAuditMetadata);

  return router;
}
