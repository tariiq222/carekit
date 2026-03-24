-- CreateIndex for pgvector cosine similarity search
-- Uses HNSW (Hierarchical Navigable Small World) for fast approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS "knowledge_base_embedding_hnsw_idx"
ON "knowledge_base"
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
