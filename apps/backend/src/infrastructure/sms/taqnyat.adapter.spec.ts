import { createHmac } from 'crypto';
import { TaqnyatAdapter } from './taqnyat.adapter';

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  (global.fetch as unknown) = jest.fn().mockResolvedValueOnce({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

describe('TaqnyatAdapter', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('POSTs to /v1/messages and returns provider message id', async () => {
    mockFetchOnce({ statusCode: 200, messageId: 'tqn-456' });
    const adapter = new TaqnyatAdapter({ apiToken: 'tok' });
    const res = await adapter.send('+966500000000', 'hi', 'Deqah');
    expect(res).toEqual({ providerMessageId: 'tqn-456', status: 'SENT' });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.taqnyat.sa/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer tok',
        }),
      }),
    );
  });

  it('throws when statusCode is not 200', async () => {
    mockFetchOnce({ statusCode: 401, message: 'bad token' });
    const adapter = new TaqnyatAdapter({ apiToken: 'tok' });
    await expect(adapter.send('+9665', 'hi', null)).rejects.toThrow(
      /Taqnyat error/,
    );
  });

  it('verifies correct HMAC and rejects bad HMAC', () => {
    const adapter = new TaqnyatAdapter({ apiToken: 'tok' });
    const raw = '{"messageId":"x","status":"delivered"}';
    const good = createHmac('sha256', 'wh').update(raw).digest('hex');
    expect(() =>
      adapter.verifyDlrSignature(
        {
          providerMessageId: 'x',
          status: 'DELIVERED',
          rawBody: raw,
          signature: good,
        },
        'wh',
      ),
    ).not.toThrow();
    expect(() =>
      adapter.verifyDlrSignature(
        {
          providerMessageId: 'x',
          status: 'DELIVERED',
          rawBody: raw,
          signature: 'deadbeef',
        },
        'wh',
      ),
    ).toThrow(/signature/);
  });

  it('parses DLR body', () => {
    const adapter = new TaqnyatAdapter({ apiToken: 'tok' });
    expect(
      adapter.parseDlr('{"messageId":"m1","status":"delivered"}'),
    ).toEqual({
      providerMessageId: 'm1',
      status: 'DELIVERED',
      errorCode: undefined,
      errorMessage: undefined,
    });
  });
});
