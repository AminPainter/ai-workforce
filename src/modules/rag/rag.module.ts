import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EmbeddingService } from './services/embedding.service';
import { PdfParserService } from './services/pdf-parser.service';
import { ChunkerService } from './services/chunker.service';
import { VectorStoreService } from './services/vector-store.service';
import { RagRetrievalService } from './services/rag-retrieval.service';
import { RagIngestService } from './ingest/rag-ingest.service';

@Module({
  imports: [AiModule, PrismaModule],
  providers: [
    EmbeddingService,
    PdfParserService,
    ChunkerService,
    VectorStoreService,
    RagRetrievalService,
    RagIngestService,
  ],
  exports: [RagRetrievalService, RagIngestService],
})
export class RagModule {}
