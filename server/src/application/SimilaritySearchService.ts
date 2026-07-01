import type { IEntryRepository } from '../ports/IEntryRepository.js';
import type { VectorSpace } from '../domain/entry/Intelligence.js';
import type { SimilarityMatch } from '../domain/entry/Similarity.js';
import { VectorService } from '../domain/intelligence/VectorService.js';
import { NotFoundError, ValidationError } from './errors.js';

/**
 * Multi-space similarity search (Feature 3). Ranks other enriched entries against the
 * query entry's vector in the chosen space using cosine similarity, returning the top-K.
 */
export class SimilaritySearchService {
  private static readonly CANDIDATE_LIMIT = 1000;

  constructor(private readonly repo: IEntryRepository) {}

  async search(entryId: string, strategy: VectorSpace, topK = 5): Promise<SimilarityMatch[]> {
    const entry = await this.repo.findById(entryId);
    if (!entry) throw new NotFoundError(`Entry ${entryId} not found`);

    const vectors = entry.intelligence.vectors;
    if (!vectors) {
      throw new ValidationError('Entry has not been enriched yet; no vectors to compare');
    }
    const query = vectors[strategy];

    const candidates = await this.repo.findSimilarityCandidates(
      entryId,
      SimilaritySearchService.CANDIDATE_LIMIT,
    );

    return candidates
      .map((c) => ({
        entryId: c.id,
        entryNo: c.entryNo,
        name: c.name,
        amount: c.amount,
        score: Number(VectorService.cosine(query, c.vectors[strategy]).toFixed(6)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}
