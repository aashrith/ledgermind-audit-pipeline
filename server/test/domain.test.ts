/**
 * Domain logic tests — pure, deterministic, no database required.
 * Run with: npm test
 */
import assert from 'node:assert';
import type { EntryCore } from '../src/domain/entry/Entry.js';
import { RiskScoringService } from '../src/domain/intelligence/RiskScoringService.js';
import { AnomalyDetectionService } from '../src/domain/intelligence/AnomalyDetectionService.js';
import { ComplianceService } from '../src/domain/intelligence/ComplianceService.js';
import { VectorService } from '../src/domain/intelligence/VectorService.js';
import { SimilaritySearchService } from '../src/application/SimilaritySearchService.js';
import type { IEntryRepository } from '../src/ports/IEntryRepository.js';
import type { Entry } from '../src/domain/entry/Entry.js';
import type { SimilarityCandidate } from '../src/domain/entry/Similarity.js';

const risk = new RiskScoringService();
const anomaly = new AnomalyDetectionService();
const compliance = new ComplianceService();
const vector = new VectorService();

const base: EntryCore = {
  postingDate: new Date('2026-06-22T10:30:00.000Z'), // Monday, daytime
  transactionType: 'Journal Entry',
  entryNo: 'JE-1',
  name: 'ABC Traders Pvt Ltd',
  description: 'Purchase of raw materials for production',
  amount: 125000,
  debit: 125000,
  credit: 0,
  currency: 'INR',
  glNumber: '400120',
  postingBy: 'user_8392',
  companyId: '64b8f0000000000000000001',
  userId: '64b8f0000000000000000002',
  sourceId: 'u1',
  uploadId: 'f1',
  systemCreated: false,
  uploadSourceType: 1,
};

// A balanced, daytime, well-formed entry should be low risk with no anomalies/flags.
const clean = risk.assess(base);
assert.equal(clean.severity, 'low', `clean severity ${clean.severity}`);
assert.equal(anomaly.detect(base).length, 0, 'clean entry has no anomalies');
assert.equal(compliance.evaluate(base, clean.riskScore).length, 0, 'clean entry has no flags');
console.log(`✓ clean entry: risk=${clean.riskScore} severity=${clean.severity}`);

// Unbalanced, high amount, weekend + late-night, suspicious words, malformed GL.
const risky: EntryCore = {
  ...base,
  postingDate: new Date('2026-06-21T02:30:00.000Z'), // Sunday 02:30
  description: 'Manual adjustment reversal urgent override',
  amount: 5_000_000,
  debit: 5_000_000,
  credit: 1_000_000,
  glNumber: 'XX',
};
const r = risk.assess(risky);
const types = new Set(anomaly.detect(risky).map((a) => a.type));
const flags = compliance.evaluate(risky, r.riskScore);
assert.equal(r.severity, 'high', `risky severity ${r.severity}`);
assert.ok(r.riskScore >= 0.67, `risky score ${r.riskScore}`);
for (const t of [
  'balance_mismatch',
  'numeric_outlier',
  'temporal_anomaly',
  'semantic_anomaly',
  'gl_pattern_anomaly',
]) {
  assert.ok(types.has(t as never), `expected anomaly ${t}`);
}
assert.ok(flags.some((f) => f.code === 'DOUBLE_ENTRY_VIOLATION'), 'expected double-entry flag');
assert.ok(flags.some((f) => f.code === 'HIGH_RISK_REVIEW'), 'expected high-risk flag');
console.log(`✓ risky entry: risk=${r.riskScore} severity=${r.severity} anomalies=${types.size} flags=${flags.length}`);

// Vectors: deterministic, unit-norm, dim 16, space-isolated, sane cosine.
const va = vector.generate(risky);
const vb = vector.generate(risky);
assert.deepEqual(va, vb, 'vectors must be deterministic');
assert.equal(va.semantic.length, 16, 'dim 16');
const norm = Math.sqrt(va.semantic.reduce((s, x) => s + x * x, 0));
assert.ok(Math.abs(norm - 1) < 1e-3, `unit-norm expected, got ${norm}`);
assert.equal(Number(VectorService.cosine(va.semantic, va.semantic).toFixed(6)), 1, 'cosine(v,v)=1');
const vc = vector.generate({ ...risky, amount: 7 });
assert.notDeepEqual(vc.financial, va.financial, 'financial vector reacts to amount');
assert.deepEqual(vc.semantic, va.semantic, 'semantic vector unaffected by amount');
console.log('✓ vectors: deterministic, unit-norm, dim=16, space-isolated');

// Similarity ranking (pure, with an in-memory fake repository).
async function similarityCheck(): Promise<void> {
  const queryVectors = vector.generate(risky);
  const identical: SimilarityCandidate = {
    id: 'a',
    entryNo: 'A',
    name: 'identical',
    amount: 1,
    glNumber: '',
    vectors: vector.generate(risky), // same fields → identical vectors → cosine 1
  };
  const different: SimilarityCandidate = {
    id: 'b',
    entryNo: 'B',
    name: 'different',
    amount: 2,
    glNumber: '',
    vectors: vector.generate(base),
  };

  const fakeRepo = {
    findById: async () => ({ id: 'q', intelligence: { vectors: queryVectors } }) as unknown as Entry,
    findSimilarityCandidates: async () => [different, identical],
  } as unknown as IEntryRepository;

  const service = new SimilaritySearchService(fakeRepo);
  const matches = await service.search('q', 'semantic', 2);
  assert.equal(matches[0].entryId, 'a', 'identical entry should rank first');
  assert.ok(matches[0].score > matches[1].score, 'scores should be ordered desc');
  assert.ok(Math.abs(matches[0].score - 1) < 1e-6, 'identical vectors → cosine 1');
  console.log(`✓ similarity: top match=${matches[0].entryNo} score=${matches[0].score}`);

  console.log('\nDOMAIN LOGIC TESTS PASSED ✅');
}

similarityCheck().catch((err) => {
  console.error(err);
  process.exit(1);
});
