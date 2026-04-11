-- Add IVFFlat cosine index on DocumentChunk.embedding for pgvector similarity search.
-- lists=100 is appropriate for datasets up to ~1M rows; tune upward if needed.
CREATE INDEX "DocumentChunk_embedding_cosine_idx"
  ON "DocumentChunk"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
