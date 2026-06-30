import type { EntryCore } from '../entry/Entry.js';
import { VECTOR_DIM, type Vectors } from '../entry/Intelligence.js';

/**
 * Multi-space vector generation (Feature 3).
 *
 * Three mock embedding spaces — semantic, financial, entity — each derived
 * *deterministically* from a seeded PRNG over the relevant field values, so the same
 * entry always produces the same vectors (stable across runs). Vectors are L2-normalized
 * so cosine similarity reduces to a dot product.
 */
export class VectorService {
  generate(entry: EntryCore): Vectors {
    return {
      semantic: this.embed(`semantic|${entry.transactionType}|${entry.name}|${entry.description}`),
      financial: this.embed(
        `financial|${entry.amount}|${entry.debit}|${entry.credit}|${entry.currency}|${entry.glNumber}`,
      ),
      entity: this.embed(`entity|${entry.name}|${entry.companyId}|${entry.postingBy}|${entry.userId}`),
    };
  }

  private embed(seedSource: string): number[] {
    const rand = mulberry32(hashString(seedSource));
    const raw = Array.from({ length: VECTOR_DIM }, () => rand() * 2 - 1); // [-1, 1)
    return l2normalize(raw);
  }

  /** Cosine similarity of two equal-length vectors. Returns 0 if either is degenerate. */
  static cosine(a: number[], b: number[]): number {
    if (a.length === 0 || a.length !== b.length) return 0;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }
}

/** Deterministic 32-bit string hash (cyrb53-lite) used to seed the PRNG. */
function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — tiny, fast, fully deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function l2normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  if (norm === 0) return v;
  return v.map((x) => Number((x / norm).toFixed(6)));
}
