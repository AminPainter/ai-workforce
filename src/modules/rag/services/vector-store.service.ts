import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import pgvector from 'pgvector/pg';
import { RAG_DB } from '../constants';

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
  constructor(@Inject(RAG_DB) private readonly ragDb: Pool) {}

  async upsertDocument(
    params: UpsertDocumentParams,
  ): Promise<UpsertDocumentResult> {
    const existing = await this.ragDb.query<{ id: string; checksum: string }>(
      'SELECT id, checksum FROM rag_document WHERE collection = $1 AND source_uri = $2',
      [params.collection, params.sourceUri],
    );
    if (existing.rows[0]?.checksum === params.checksum)
      return { id: existing.rows[0].id, changed: false };

    const upserted = await this.ragDb.query<{ id: string }>(
      `INSERT INTO rag_document (collection, source_uri, title, checksum, metadata)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (collection, source_uri) DO UPDATE
         SET checksum = EXCLUDED.checksum,
             title = EXCLUDED.title,
             metadata = EXCLUDED.metadata
       RETURNING id`,
      [
        params.collection,
        params.sourceUri,
        params.title,
        params.checksum,
        params.metadata ?? {},
      ],
    );
    return { id: upserted.rows[0].id, changed: true };
  }

  async deleteChunks(documentId: string): Promise<void> {
    await this.ragDb.query('DELETE FROM rag_chunk WHERE document_id = $1', [
      documentId,
    ]);
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
          chunk.metadata ?? {},
          pgvector.toSql(chunk.embedding),
        );
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
      });
      await this.ragDb.query(
        `INSERT INTO rag_chunk
           (document_id, collection, chunk_index, content, page, metadata, embedding)
         VALUES ${rows.join(', ')}`,
        values,
      );
    }
  }

  async search(
    collection: string,
    queryEmbedding: number[],
    limit: number,
  ): Promise<SearchResult[]> {
    const result = await this.ragDb.query<{
      content: string;
      page: number | null;
      document_id: string;
      source_uri: string;
      title: string | null;
      similarity: string;
    }>(
      `SELECT c.content, c.page, c.document_id, d.source_uri, d.title,
              1 - (c.embedding <=> $2::vector) AS similarity
       FROM rag_chunk c
       JOIN rag_document d ON d.id = c.document_id
       WHERE c.collection = $1
       ORDER BY c.embedding <=> $2::vector
       LIMIT $3`,
      [collection, pgvector.toSql(queryEmbedding), limit],
    );
    return result.rows.map((row) => ({
      content: row.content,
      page: row.page,
      documentId: row.document_id,
      sourceUri: row.source_uri,
      title: row.title,
      similarity: Number(row.similarity),
    }));
  }
}
