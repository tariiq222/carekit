/**
 * External API base URLs — single source of truth.
 */

export const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const OPENROUTER_EMBEDDINGS_URL = 'https://openrouter.ai/api/v1/embeddings';
export const MOYASAR_API_BASE = 'https://api.moyasar.com/v1';
export const ZOOM_API_BASE = 'https://api.zoom.us/v2';
export const ZOOM_OAUTH_URL = 'https://zoom.us/oauth/token';

/** Default HTTP headers for OpenRouter requests. */
export const OPENROUTER_HEADERS = {
  'HTTP-Referer': 'carekit',
  'X-Title': 'CareKit',
} as const;
