export interface SemanticSearchDto {
  tenantId: string;
  query: string;
  topK?: number;
  documentId?: string;
}

export interface SemanticSearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  similarity: number;
}
