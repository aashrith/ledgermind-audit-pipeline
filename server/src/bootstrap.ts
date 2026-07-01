import type { Config } from './config/Config.js';
import { MongoEntryRepository } from './adapters/persistence/MongoEntryRepository.js';
import { MongoQueueService } from './adapters/queue/MongoQueueService.js';
import { RiskScoringService } from './domain/intelligence/RiskScoringService.js';
import { AnomalyDetectionService } from './domain/intelligence/AnomalyDetectionService.js';
import { ComplianceService } from './domain/intelligence/ComplianceService.js';
import { VectorService } from './domain/intelligence/VectorService.js';
import { EnrichmentService } from './application/EnrichmentService.js';
import { EntryService } from './application/EntryService.js';
import { SimilaritySearchService } from './application/SimilaritySearchService.js';
import { ModelMigrationService } from './application/ModelMigrationService.js';
import { ComplianceReevaluationService } from './application/ComplianceReevaluationService.js';
import type { IEntryRepository } from './ports/IEntryRepository.js';
import type { IQueueService } from './ports/IQueueService.js';

/**
 * Composition root. Wires concrete adapters into the application/domain services, so the
 * server entrypoint, the worker, and the CLI scripts all share one consistent dependency
 * graph (manual DI — no framework, fully type-checked).
 */
export interface Container {
  config: Config;
  entryRepository: IEntryRepository;
  queueService: IQueueService;
  enrichmentService: EnrichmentService;
  entryService: EntryService;
  similaritySearchService: SimilaritySearchService;
  modelMigrationService: ModelMigrationService;
  complianceReevaluationService: ComplianceReevaluationService;
}

export function createContainer(config: Config): Container {
  const entryRepository = new MongoEntryRepository();
  const queueService = new MongoQueueService();

  const enrichmentService = new EnrichmentService(
    entryRepository,
    new RiskScoringService(),
    new AnomalyDetectionService(),
    new ComplianceService(),
    new VectorService(),
    { modelVersion: config.modelVersion, riskVersion: config.riskVersion },
  );

  const entryService = new EntryService(entryRepository, queueService, {
    modelVersion: config.modelVersion,
  });

  const similaritySearchService = new SimilaritySearchService(entryRepository);
  const modelMigrationService = new ModelMigrationService(entryRepository, queueService);
  const complianceReevaluationService = new ComplianceReevaluationService(
    entryRepository,
    enrichmentService,
  );

  return {
    config,
    entryRepository,
    queueService,
    enrichmentService,
    entryService,
    similaritySearchService,
    modelMigrationService,
    complianceReevaluationService,
  };
}
