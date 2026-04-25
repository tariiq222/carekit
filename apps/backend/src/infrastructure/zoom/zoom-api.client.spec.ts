import { Test, TestingModule } from '@nestjs/testing';
import { ZoomApiClient } from './zoom-api.client';
import { InternalServerErrorException } from '@nestjs/common';

describe('ZoomApiClient', () => {
  let client: ZoomApiClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ZoomApiClient],
    }).compile();

    client = module.get<ZoomApiClient>(ZoomApiClient);
    if (jest.isMockFunction(global.fetch)) {
      (global.fetch as jest.Mock).mockClear();
    } else {
      global.fetch = jest.fn();
    }
  });

  describe('getAccessToken', () => {
    it('should fetch and cache token', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'test-token', expires_in: 3600 }),
      } as Response);

      const token = await client.getAccessToken('org-1', 'client', 'secret', 'account');
      expect(token).toBe('test-token');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const token2 = await client.getAccessToken('org-1', 'client', 'secret', 'account');
      expect(token2).toBe('test-token');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should throw if auth fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      } as Response);

      await expect(
        client.getAccessToken('org-1', 'client', 'secret', 'account'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('createMeeting', () => {
    it('should create a meeting', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 123, join_url: 'join', start_url: 'start' }),
      } as Response);

      const res = await client.createMeeting(
        'token',
        { topic: 'test', startTime: '2026-04-25T10:00:00Z', durationMins: 30 },
        'Asia/Riyadh',
      );

      expect(res.id).toBe(123);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.zoom.us/v2/users/me/meetings',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer token',
          }),
        }),
      );
    });
  });

  describe('fetchWithRetry', () => {
    it('should retry on 429', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false, status: 429 } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        } as Response);

      jest.useFakeTimers();
      const promise = (client as unknown as { fetchWithRetry: (url: string, init?: RequestInit) => Promise<Response> }).fetchWithRetry('http://test.com');

      // First call
      await Promise.resolve();
      jest.advanceTimersByTime(250);
      // Second call
      await Promise.resolve();

      const res = await promise;
      expect(res.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });

    it('should fail after max retries', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Server Error',
      } as Response);

      jest.useFakeTimers();
      const promise = (client as unknown as { fetchWithRetry: (url: string, init?: RequestInit) => Promise<Response> }).fetchWithRetry('http://test.com');

      for (let i = 0; i < 4; i++) {
        // Allow fetch promise to resolve
        await Promise.resolve();
        // Allow the retry logic to proceed to setTimeout
        await Promise.resolve();
        // Run the timer
        jest.runAllTimers();
        // Allow the backoff promise to resolve
        await Promise.resolve();
      }

      const res = await promise;
      expect(res.ok).toBe(false);
      expect(global.fetch).toHaveBeenCalledTimes(4); // initial + 3 retries
      jest.useRealTimers();
    });
  });
});
