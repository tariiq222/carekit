import { createHmac } from 'crypto';
import { UnifonicAdapter } from './unifonic.adapter';

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  (global.fetch as unknown) = jest.fn().mockResolvedValueOnce({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

describe('UnifonicAdapter', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('POSTs to /rest/SMS/messages and returns provider message id', async () => {
    mockFetchOnce({ success: true, data: { MessageID: 'unif-123' } });
    const adapter = new UnifonicAdapter({ appSid: 'sid', apiKey: 'key' });
    const res = await adapter.send('+966500000000', 'hi', 'Deqah');
    expect(res).toEqual({ providerMessageId: 'unif-123', status: 'SENT' });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.unifonic.com/rest/SMS/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer key',
        }),
      }),
    );
  });

  it('throws when provider returns success=false', async () => {
    mockFetchOnce({ success: false, message: 'bad' });
    const adapter = new UnifonicAdapter({ appSid: 'sid', apiKey: 'key' });
    await expect(
      adapter.send('+966500000000', 'hi', null),
    ).rejects.toThrow(/Unifonic error/);
  });

  it('verifies a correct HMAC DLR signature', () => {
    const adapter = new UnifonicAdapter({ appSid: 'sid', apiKey: 'key' });
    const raw = '{"messageId":"x","status":"delivered"}';
    const sig = createHmac('sha256', 'secret').update(raw).digest('hex');
    expect(() =>
      adapter.verifyDlrSignature(
        {
          providerMessageId: 'x',
          status: 'DELIVERED',
          rawBody: raw,
          signature: sig,
        },
        'secret',
      ),
    ).not.toThrow();
  });

  it('rejects bad HMAC DLR signature', () => {
    const adapter = new UnifonicAdapter({ appSid: 'sid', apiKey: 'key' });
    expect(() =>
      adapter.verifyDlrSignature(
        {
          providerMessageId: 'x',
          status: 'DELIVERED',
          rawBody: '{}',
          signature: 'deadbeef',
        },
        'secret',
      ),
    ).toThrow(/signature/);
  });

  it('parses DLR body into ParsedDlr shape', () => {
    const adapter = new UnifonicAdapter({ appSid: 'sid', apiKey: 'key' });
    expect(
      adapter.parseDlr('{"messageId":"m1","status":"delivered"}'),
    ).toEqual({
      providerMessageId: 'm1',
      status: 'DELIVERED',
      errorCode: undefined,
      errorMessage: undefined,
    });
    expect(
      adapter.parseDlr(
        '{"messageId":"m2","status":"failed","errorCode":"E1","errorMessage":"boom"}',
      ),
    ).toEqual({
      providerMessageId: 'm2',
      status: 'FAILED',
      errorCode: 'E1',
      errorMessage: 'boom',
    });
  });
});
