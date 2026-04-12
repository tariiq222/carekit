import { aiConfig } from './ai.config';

describe('aiConfig', () => {
  it('registers ai config with expected structure', () => {
    const config = aiConfig();
    expect(config).toHaveProperty('openaiApiKey');
    expect(config).toHaveProperty('embeddingModel');
    expect(config).toHaveProperty('openrouterApiKey');
    expect(config).toHaveProperty('openrouterBaseUrl');
    expect(config).toHaveProperty('chatModel');
  });

  it('uses default values when env vars not set', () => {
    const config = aiConfig();
    expect(typeof config.chatModel).toBe('string');
    expect(typeof config.openrouterBaseUrl).toBe('string');
  });
});