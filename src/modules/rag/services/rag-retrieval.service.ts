import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingService } from './embedding.service';
import { VectorStoreService } from './vector-store.service';

const DEFAULT_TOP_K = 5;
// Conservative floor: drops clearly-unrelated chunks while staying well below
// the point where legitimate matches get filtered. Tune RAG_MIN_SIMILARITY per
// embedding model — raise it once calibrated against the ingested collection.
const DEFAULT_MIN_SIMILARITY = 0.2;

@Injectable()
export class RagRetrievalService {
  private readonly topK: number;
  private readonly minSimilarity: number;

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly vectorStoreService: VectorStoreService,
    private readonly configService: ConfigService,
  ) {
    this.topK = Number(
      this.configService.get('RAG_RETRIEVAL_TOP_K') ?? DEFAULT_TOP_K,
    );
    this.minSimilarity = Number(
      this.configService.get('RAG_MIN_SIMILARITY') ?? DEFAULT_MIN_SIMILARITY,
    );
  }

  async search(collection: string, query: string): Promise<string> {
    const embedding = await this.embeddingService.embedQuery(query);
    const results = await this.vectorStoreService.search(
      collection,
      embedding,
      this.topK,
    );
    const relevant = results.filter(
      (result) => result.similarity >= this.minSimilarity,
    );

    if (relevant.length === 0)
      return 'No matching passages found in the knowledge base.';

    return relevant
      .map((result, index) => {
        const page = result.page === null ? '?' : result.page;
        return `[${index + 1}] ${result.sourceUri} p.${page} (similarity ${result.similarity.toFixed(3)})\n${result.content.trim()}`;
      })
      .join('\n\n');
  }
}
