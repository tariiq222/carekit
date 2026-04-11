/**
 * AI model name constants — single source of truth.
 * These are fallback defaults; per-client config may override them.
 */

export const DEFAULT_CHAT_MODEL = 'openai/gpt-4o';
export const DEFAULT_EMBEDDING_MODEL = 'openai/text-embedding-3-small';
export const RECEIPT_VERIFICATION_MODEL = 'google/gemini-flash-1.5';

/** RAG similarity threshold (cosine distance). */
export const RAG_SIMILARITY_THRESHOLD = 0.3;

/** Batch size for concurrent embedding generation. */
export const EMBEDDING_BATCH_SIZE = 5;
