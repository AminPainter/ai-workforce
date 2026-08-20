import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { PdfParserService } from '../services/pdf-parser.service';
import { ChunkerService } from '../services/chunker.service';
import { EmbeddingService } from '../services/embedding.service';
import { VectorStoreService } from '../services/vector-store.service';

export interface IngestSummary {
  documents: number;
  ingested: number;
  skipped: number;
  chunks: number;
}

@Injectable()
export class RagIngestService {
  private readonly logger = new Logger(RagIngestService.name);

  constructor(
    private readonly pdfParserService: PdfParserService,
    private readonly chunkerService: ChunkerService,
    private readonly embeddingService: EmbeddingService,
    private readonly vectorStoreService: VectorStoreService,
  ) {}

  async ingestDirectory(
    collection: string,
    dir: string,
  ): Promise<IngestSummary> {
    const files = readdirSync(dir)
      .filter((file) => file.toLowerCase().endsWith('.pdf'))
      .sort();

    const summary: IngestSummary = {
      documents: files.length,
      ingested: 0,
      skipped: 0,
      chunks: 0,
    };

    for (const file of files) {
      const chunks = await this.ingestFile(collection, join(dir, file));
      if (chunks === null) summary.skipped += 1;
      else {
        summary.ingested += 1;
        summary.chunks += chunks;
      }
    }

    this.logger.log(
      `ingest complete: ${summary.ingested} ingested, ${summary.skipped} unchanged, ${summary.chunks} chunks (collection=${collection})`,
    );
    return summary;
  }

  private async ingestFile(
    collection: string,
    filePath: string,
  ): Promise<number | null> {
    const bytes = readFileSync(filePath);
    const sourceUri = basename(filePath);
    const checksum = createHash('sha256').update(bytes).digest('hex');

    const document = await this.vectorStoreService.upsertDocument({
      collection,
      sourceUri,
      title: sourceUri,
      checksum,
    });
    if (!document.changed) {
      this.logger.log(`skip ${sourceUri} (unchanged)`);
      return null;
    }

    await this.vectorStoreService.deleteChunks(document.id);

    const pages = await this.pdfParserService.parse(new Uint8Array(bytes));
    const chunks = this.chunkerService.chunk(pages);
    if (chunks.length === 0) {
      this.logger.warn(`no text extracted from ${sourceUri}`);
      return 0;
    }

    const embeddings = await this.embeddingService.embedDocuments(
      chunks.map((chunk) => chunk.content),
    );
    await this.vectorStoreService.insertChunks(
      document.id,
      collection,
      chunks.map((chunk, index) => ({
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        page: chunk.page,
        embedding: embeddings[index],
      })),
    );

    this.logger.log(`ingested ${sourceUri} (${chunks.length} chunks)`);
    return chunks.length;
  }
}
