CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag_document (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection  text NOT NULL,
  source_uri  text NOT NULL,
  title       text,
  checksum    text NOT NULL,
  metadata    jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection, source_uri)
);

CREATE TABLE IF NOT EXISTS rag_chunk (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES rag_document(id) ON DELETE CASCADE,
  collection  text NOT NULL,
  chunk_index int  NOT NULL,
  content     text NOT NULL,
  page        int,
  metadata    jsonb NOT NULL DEFAULT '{}',
  embedding   vector(${RAG_EMBEDDING_DIMENSIONS}) NOT NULL
);

CREATE INDEX IF NOT EXISTS rag_chunk_collection_idx ON rag_chunk (collection);
CREATE INDEX IF NOT EXISTS rag_chunk_embedding_idx  ON rag_chunk
  USING hnsw (embedding vector_cosine_ops);
