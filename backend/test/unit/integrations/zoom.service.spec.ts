import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

const mockResilientFetch = jest.fn();

jest.mock('../../../src/common/helpers/resilient-fetch.helper.js', () => ({
  resilientFetch: mockResilientFetch,
}));

import { ZoomService } from '../../../src/modules/integrations/zoom/zoom.service.js';
import { CacheService } from '../../../src/common/services/cache.service.js';

function makeResponse(ok: boolean, status: number, body: unknown) {
  return {
    ok,
    status,
    text: jest.fn().mockResolvedValue(String(body)),
    json: jest.fn().mockResolvedValue(body),
  };
}

const mockCache: any = {
  get: jest.fn(),
  set: jest.fn(),
};

function createMockConfig(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string | undefined> = {
    ZOOM_ACCOUNT_ID: undefined,
    ZOOM_CLIENT_ID: undefined,
    ZOOM_CLIENT_SECRET: undefined,
    ...overrides,
  };
  return {
    get: jest.fn().mockImplementation((key: string) => defaults[key]),
  };
}

async function createModule(configValues: Record<string, string> = {}) {
  const mockConfig = createMockConfig(configValues);

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ZoomService,
      { provide: ConfigService, useValue: mockConfig },
      { provide: CacheService, useValue: mockCache },
    ],
  }).compile();

  return { service: module.get<ZoomService>(ZoomService), mockConfig };
}

describe('ZoomService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createMeeting — not configured', () => {
    it('returns a stub meeting when Zoom credentials are missing', async () => {
      const { service } = await createModule();

      const result = await service.createMeeting();

      expect(result.meetingId).toMatch(/^zoom-stub-/);
      expect(result.joinUrl).toMatch(/^https:\/\/zoom\.us\/j\//);
      expect(result.hostUrl).toMatch(/^https:\/\/zoom\.us\/s\//);
      expect(mockResilientFetch).not.toHaveBeenCalled();
    });
  });

  describe('createMeeting — configured', () => {
    const credentials = {
      ZOOM_ACCOUNT_ID: 'acct-1',
      ZOOM_CLIENT_ID: 'client-1',
      ZOOM_CLIENT_SECRET: 'secret-1',
    };

    it('creates an instant meeting (no startTime) and returns mapped response', async () => {
      const { service } = await createModule(credentials);

      mockCache.get.mockResolvedValue('cached-token');
      mockResilientFetch.mockResolvedValue(
        makeResponse(true, 200, {
          id: 12345,
          join_url: 'https://zoom.us/j/12345',
          start_url: 'https://zoom.us/s/12345',
        }),
      );

      const result = await service.createMeeting('Test Topic');

      expect(result).toEqual({
        meetingId: '12345',
        joinUrl: 'https://zoom.us/j/12345',
        hostUrl: 'https://zoom.us/s/12345',
      });
    });

    it('sends type=2 for scheduled meetings and type=1 for instant', async () => {
      const { service } = await createModule(credentials);

      mockCache.get.mockResolvedValue('cached-token');
      mockResilientFetch.mockResolvedValue(
        makeResponse(true, 200, { id: 99, join_url: 'j', start_url: 's' }),
      );

      await service.createMeeting('Topic', '2026-04-01T10:00:00Z');

      const body = JSON.parse(
        mockResilientFetch.mock.calls[0][1].body as string,
      );
      expect(body.type).toBe(2);
      expect(body.start_time).toBe('2026-04-01T10:00:00Z');
    });

    it('throws when Zoom API returns a non-ok response', async () => {
      const { service } = await createModule(credentials);

      mockCache.get.mockResolvedValue('cached-token');
      mockResilientFetch.mockResolvedValue(
        makeResponse(false, 401, 'Unauthorized'),
      );

      await expect(service.createMeeting()).rejects.toThrow(
        'Zoom API error: 401',
      );
    });
  });

  describe('deleteMeeting', () => {
    it('returns without calling fetch when not configured', async () => {
      const { service } = await createModule();

      await service.deleteMeeting('meeting-123');

      expect(mockResilientFetch).not.toHaveBeenCalled();
    });

    it('returns without calling fetch for stub meeting IDs', async () => {
      const { service } = await createModule({
        ZOOM_ACCOUNT_ID: 'acct-1',
        ZOOM_CLIENT_ID: 'client-1',
        ZOOM_CLIENT_SECRET: 'secret-1',
      });

      await service.deleteMeeting('zoom-stub-abc123');

      expect(mockResilientFetch).not.toHaveBeenCalled();
    });

    it('calls DELETE endpoint for real meeting IDs', async () => {
      const { service } = await createModule({
        ZOOM_ACCOUNT_ID: 'acct-1',
        ZOOM_CLIENT_ID: 'client-1',
        ZOOM_CLIENT_SECRET: 'secret-1',
      });

      mockCache.get.mockResolvedValue('cached-token');
      mockResilientFetch.mockResolvedValue(makeResponse(true, 204, ''));

      await service.deleteMeeting('meeting-999');

      expect(mockResilientFetch).toHaveBeenCalledWith(
        'https://api.zoom.us/v2/meetings/meeting-999',
        expect.objectContaining({ method: 'DELETE' }),
        expect.anything(),
      );
    });

    it('does not throw on 404 response (meeting already deleted)', async () => {
      const { service } = await createModule({
        ZOOM_ACCOUNT_ID: 'acct-1',
        ZOOM_CLIENT_ID: 'client-1',
        ZOOM_CLIENT_SECRET: 'secret-1',
      });

      mockCache.get.mockResolvedValue('cached-token');
      mockResilientFetch.mockResolvedValue(
        makeResponse(false, 404, 'Not Found'),
      );

      await expect(
        service.deleteMeeting('meeting-404'),
      ).resolves.toBeUndefined();
    });

    it('logs warning but does not throw on non-404 failure', async () => {
      const { service } = await createModule({
        ZOOM_ACCOUNT_ID: 'acct-1',
        ZOOM_CLIENT_ID: 'client-1',
        ZOOM_CLIENT_SECRET: 'secret-1',
      });

      mockCache.get.mockResolvedValue('cached-token');
      mockResilientFetch.mockResolvedValue(
        makeResponse(false, 500, 'Server Error'),
      );

      await expect(
        service.deleteMeeting('meeting-500'),
      ).resolves.toBeUndefined();
    });
  });

  describe('getAccessToken (via createMeeting)', () => {
    const credentials = {
      ZOOM_ACCOUNT_ID: 'acct-1',
      ZOOM_CLIENT_ID: 'client-1',
      ZOOM_CLIENT_SECRET: 'secret-1',
    };

    it('returns cached token without calling OAuth when cache has token', async () => {
      const { service } = await createModule(credentials);

      mockCache.get.mockResolvedValue('cached-access-token');
      mockResilientFetch.mockResolvedValue(
        makeResponse(true, 200, { id: 1, join_url: 'j', start_url: 's' }),
      );

      await service.createMeeting();

      // Only one call — to create meeting, not to OAuth
      expect(mockResilientFetch).toHaveBeenCalledTimes(1);
      expect(mockResilientFetch.mock.calls[0][0]).toBe(
        'https://api.zoom.us/v2/users/me/meetings',
      );
    });

    it('fetches OAuth token and caches it when cache is empty', async () => {
      const { service } = await createModule(credentials);

      mockCache.get.mockResolvedValue(null);
      // First call: OAuth, Second call: create meeting
      mockResilientFetch
        .mockResolvedValueOnce(
          makeResponse(true, 200, {
            access_token: 'fresh-token',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
        )
        .mockResolvedValueOnce(
          makeResponse(true, 200, { id: 2, join_url: 'j', start_url: 's' }),
        );

      await service.createMeeting();

      expect(mockCache.set).toHaveBeenCalledWith(
        'zoom:access_token',
        'fresh-token',
        3540, // 3600 - 60
      );
    });

    it('throws when OAuth token request fails', async () => {
      const { service } = await createModule(credentials);

      mockCache.get.mockResolvedValue(null);
      mockResilientFetch.mockResolvedValue(
        makeResponse(false, 400, 'Bad Request'),
      );

      await expect(service.createMeeting()).rejects.toThrow(
        'Zoom OAuth error: 400',
      );
    });
  });
});
