import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import pgvector from 'pgvector';
import { PrismaService } from '../../prisma/prisma.service';

const INSERT_BATCH_ROWS = 200;

export interface UpsertDocumentParams {
  collection: string;
  sourceUri: string;
  title: string | null;
  checksum: string;
  metadata?: Record<string, unknown>;
}

export interface UpsertDocumentResult {
  id: string;
  changed: boolean;
}

export interface ChunkInsert {
  chunkIndex: number;
  content: string;
  page: number | null;
  embedding: number[];
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  content: string;
  page: number | null;
  documentId: string;
  sourceUri: string;
  title: string | null;
  similarity: number;
}

@Injectable()
export class VectorStoreService {
  constructor(private readonly prismaService: PrismaService) {}

  async upsertDocument(
    params: UpsertDocumentParams,
  ): Promise<UpsertDocumentResult> {
    const where = {
      collection_sourceUri: {
        collection: params.collection,
        sourceUri: params.sourceUri,
      },
    };
    const metadata = (params.metadata ?? {}) as Prisma.InputJsonValue;

    const existing = await this.prismaService.ragDocument.findUnique({
      where,
      select: { id: true, checksum: true },
    });
    if (existing?.checksum === params.checksum)
      return { id: existing.id, changed: false };

    const upserted = await this.prismaService.ragDocument.upsert({
      where,
      create: {
        collection: params.collection,
        sourceUri: params.sourceUri,
        title: params.title,
        checksum: params.checksum,
        metadata,
      },
      update: {
        title: params.title,
        checksum: params.checksum,
        metadata,
      },
      select: { id: true },
    });
    return { id: upserted.id, changed: true };
  }

  async deleteChunks(documentId: string): Promise<void> {
    await this.prismaService.ragChunk.deleteMany({ where: { documentId } });
  }

  async insertChunks(
    documentId: string,
    collection: string,
    chunks: ChunkInsert[],
  ): Promise<void> {
    for (let i = 0; i < chunks.length; i += INSERT_BATCH_ROWS) {
      const batch = chunks.slice(i, i + INSERT_BATCH_ROWS);
      const values: unknown[] = [];
      const rows = batch.map((chunk, row) => {
        const base = row * 7;
        values.push(
          documentId,
          collection,
          chunk.chunkIndex,
          chunk.content,
          chunk.page,
          JSON.stringify(chunk.metadata ?? {}),
          pgvector.toSql(chunk.embedding),
        );
        return `($${base + 1}::uuid, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}::jsonb, $${base + 7}::vector)`;
      });
      await this.prismaService.$executeRawUnsafe(
        `INSERT INTO rag_chunk
           (document_id, collection, chunk_index, content, page, metadata, embedding)
         VALUES ${rows.join(', ')}`,
        ...values,
      );
    }
  }

  async search(
    collection: string,
    queryEmbedding: number[],
    limit: number,
  ): Promise<SearchResult[]> {
    const rows = await this.prismaService.$queryRawUnsafe<
      Array<{
        content: string;
        page: number | null;
        document_id: string;
        source_uri: string;
        title: string | null;
        similarity: number;
      }>
    >(
      `SELECT c.content, c.page, c.document_id, d.source_uri, d.title,
              1 - (c.embedding <=> $1::vector) AS similarity
       FROM rag_chunk c
       JOIN rag_document d ON d.id = c.document_id
       WHERE c.collection = $2
       ORDER BY c.embedding <=> $1::vector
       LIMIT $3`,
      pgvector.toSql(queryEmbedding),
      collection,
      limit,
    );
    return rows.map((row) => ({
      content: row.content,
      page: row.page,
      documentId: row.document_id,
      sourceUri: row.source_uri,
      title: row.title,
      similarity: Number(row.similarity),
    }));
  }
}
