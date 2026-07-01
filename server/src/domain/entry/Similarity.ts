import type { Vectors } from './Intelligence.js';

/** Lightweight projection of an enriched entry used for similarity ranking. */
export interface SimilarityCandidate {
  id: string;
  entryNo: string;
  name: string;
  amount: number;
  glNumber: string;
  vectors: Vectors;
}

/** One ranked similarity result returned to the client. */
export interface SimilarityMatch {
  entryId: string;
  entryNo: string;
  name: string;
  amount: number;
  score: number; // cosine similarity in [-1, 1]
}
