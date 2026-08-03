import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { embed, embedMany } from 'ai';
import { AiService } from '../../ai/services/ai.service';

const DEFAULT_BATCH_SIZE = 96;

@Injectable()
export class EmbeddingService {
  private readonly batchSize: number;

  constructor(
    private readonly aiService: AiService,
    private readonly configService: ConfigService,
  ) {
    this.batchSize = Number(
      this.configService.get('RAG_EMBEDDING_BATCH_SIZE') ?? DEFAULT_BATCH_SIZE,
    );
  }

  async embedQuery(query: string): Promise<number[]> {
    const { embedding } = await embed({
      model: this.aiService.embeddingModel(),
      value: query,
    });
    return embedding;
  }

  async embedDocuments(values: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    for (let i = 0; i < values.length; i += this.batchSize) {
      const batch = values.slice(i, i + this.batchSize);
      const result = await embedMany({
        model: this.aiService.embeddingModel(),
        values: batch,
      });
      embeddings.push(...result.embeddings);
    }
    return embeddings;
  }
}
