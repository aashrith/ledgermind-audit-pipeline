# LedgerMind Audit Pipeline

> Event-driven MERN application for ingesting immutable financial journal entries and
> asynchronously enriching them with AI-style audit intelligence — context-aware risk
> scoring, granular anomaly detection, compliance evaluation, and multi-space vector
> similarity search.

> **Status:** 🚧 Work in progress. This README is built up incrementally alongside the
> codebase; sections are filled as each phase lands. See `git log` for the increment trail.

---

## 1. Project Overview

_TBD — expand as features land._

## 2. Architecture (C4)

### 2.1 Container diagram

How the running pieces fit together. The API stays low-latency by offloading expensive
enrichment to a separate worker, decoupled through a MongoDB-backed queue.

```mermaid
C4Container
    title Container diagram — LedgerMind Audit Pipeline

    Person(auditor, "Auditor", "Inspects risk signals, vector diagnostics, and similar transactions")

    System_Boundary(sys, "LedgerMind Audit Pipeline") {
        Container(spa, "Audit Dashboard", "React class components, Bootstrap", "Table, diagnostics modal, similarity search; fetches in lifecycle methods")
        Container(api, "API Server", "Node.js, Express, TypeScript", "Persists entries, serves reads, enqueues enrichment; never blocks on AI work")
        Container(worker, "Enrichment Worker", "Node.js, class-based poller", "Claims jobs, computes risk/anomalies/vectors, writes back via targeted $set")
        ContainerDb(db, "MongoDB", "MongoDB", "entries (core + audit + intelligence) and queue_jobs")
    }

    Rel(auditor, spa, "Uses", "HTTPS")
    Rel(spa, api, "REST / JSON", "HTTPS")
    Rel(api, db, "Reads/writes entries; enqueues jobs", "Mongoose")
    Rel(worker, db, "Atomically claims jobs; writes intelligence", "Mongoose")
    UpdateRelStyle(api, db, $offsetY="-10")
```

### 2.2 Component diagram — API Server

Inside the API container: a light hexagonal (ports & adapters) layout. Services depend on
**ports**, not on Mongoose, so persistence and queue adapters are swappable and the domain
core stays pure and unit-testable.

```mermaid
C4Component
    title Component diagram — API Server (ports & adapters)

    Container(spa, "Audit Dashboard", "React", "")
    ContainerDb(db, "MongoDB", "MongoDB", "")

    Container_Boundary(api, "API Server") {
        Component(ctrl, "EntryController", "Express, Zod", "Inbound adapter: validates requests, maps HTTP ↔ domain")
        Component(svc, "EntryService", "TS class", "Orchestration: create, core-update, metadata-update, similarity")
        Component(domain, "Domain core", "pure TS", "RiskScoring, AnomalyDetection, Vector + cosine logic — no framework imports")
        Component(repoPort, "IEntryRepository / IQueueService", "TS interfaces", "Outbound ports (hexagonal seam)")
        Component(repo, "MongoEntryRepository", "Mongoose", "Outbound adapter: targeted $set/$inc/$unset updates")
        Component(queue, "MongoQueueService", "Mongoose", "Outbound adapter: atomic findOneAndUpdate claim")
    }

    Rel(spa, ctrl, "Calls", "REST/JSON")
    Rel(ctrl, svc, "Invokes")
    Rel(svc, domain, "Uses")
    Rel(svc, repoPort, "Depends on (port)")
    Rel(repo, repoPort, "Implements")
    Rel(queue, repoPort, "Implements")
    Rel(repo, db, "Reads/writes", "Mongoose")
    Rel(queue, db, "Enqueues/claims", "Mongoose")
```

> The **Enrichment Worker** is its own container (diagram 2.1) and reuses the same
> `MongoEntryRepository` / `MongoQueueService` adapters to claim jobs and persist results.

## 3. Technology Stack

- **Backend:** Node.js, Express, TypeScript, Mongoose, Zod (request validation)
- **Database:** MongoDB
- **Worker:** MongoDB-backed queue + class-based polling worker
- **Frontend:** React (class components only), Bootstrap
- **Architecture:** light hexagonal (ports & adapters) + class-based service/repository layers

## 4. Folder Structure

```
ledgermind-audit-pipeline/
  server/
    src/
      domain/         # pure logic: risk, anomaly, vectors, value objects (no Mongo)
      application/    # EntryService, ComplianceReevaluationService (orchestration)
      ports/          # IEntryRepository, IQueueService interfaces
      adapters/
        http/         # EntryController, routes (inbound)
        persistence/  # Mongoose models, MongoEntryRepository (outbound)
        queue/        # MongoQueueService
      worker/         # EnrichmentWorker
      scripts/        # seed, migrateModels, reevaluateRisk
  client/             # React class-component dashboard
  README.md
  .env.example
```

## 5. Environment Variables

See `.env.example`. Copy to `server/.env` and adjust. Key vars: `PORT`, `MONGODB_URI`,
`MODEL_VERSION`, `RISK_VERSION`, `WORKER_ENRICH_DELAY_MS`, `BATCH_SIZE`.

## 6. Setup Instructions

```bash
npm run install:all
cp .env.example server/.env
```

## 7. MongoDB Setup

_TBD — local mongod / Atlas connection notes._

## 8. Seed Command

```bash
npm run seed
```

## 9. Server Start

```bash
npm run start:server
```

## 10. Worker Start

```bash
npm run start:worker
```

## 11. Client Start

```bash
npm run start:client
```

## 12. Model Migration

```bash
npm run migrate:models
```

## 13. Risk Reevaluation

```bash
npm run reevaluate:risk
```

## 14. API Endpoint Documentation

_TBD — table of routes lands in Phase 3._

## 15. Async Queue Design

_TBD — Phase 4._

## 16. Race-Condition Mitigation

_TBD — atomic claim via findOneAndUpdate, lockedAt/lockedBy._

## 17. Cursor Pagination / Backpressure

_TBD — Phase 6._

## 18. Partial Recomputation

_TBD — core-field change detection vs metadata-only updates._

## 19. Class-Component Frontend Constraint

_TBD — why class components, lifecycle-driven data fetching._

## 20. Demo Walkthrough Checklist

_TBD — Phase 8._
