-- Add index on payments.created_at for date-range queries
CREATE INDEX IF NOT EXISTS "payments_created_at_idx" ON "payments"("created_at");

-- Add HNSW index on knowledge_base.embedding for cosine similarity search
-- This dramatically speeds up pgvector similarity queries
CREATE INDEX IF NOT EXISTS "knowledge_base_embedding_hnsw_idx"
  ON "knowledge_base"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
