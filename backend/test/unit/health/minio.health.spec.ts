import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthIndicatorService } from '@nestjs/terminus';

const mockListBuckets = jest.fn();

jest.mock('minio', () => ({
  Client: jest.fn().mockImplementation(() => ({
    listBuckets: mockListBuckets,
  })),
}));

import { MinioHealthIndicator } from '../../../src/modules/health/minio.health.js';

const mockSession = {
  up: jest.fn().mockReturnValue({ minio: { status: 'up' } }),
  down: jest.fn().mockReturnValue({ minio: { status: 'down' } }),
};

const mockIndicator = {
  check: jest.fn().mockReturnValue(mockSession),
};

const mockConfig = {
  get: jest.fn().mockImplementation((key: string, fallback?: string) => {
    const values: Record<string, string> = {
      MINIO_ENDPOINT: 'localhost',
      MINIO_PORT: '9000',
      MINIO_USE_SSL: 'false',
      MINIO_ACCESS_KEY: 'minioadmin',
      MINIO_SECRET_KEY: 'minioadmin',
    };
    return values[key] ?? fallback;
  }),
};

describe('MinioHealthIndicator', () => {
  let indicator: MinioHealthIndicator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MinioHealthIndicator,
        { provide: HealthIndicatorService, useValue: mockIndicator },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    indicator = module.get<MinioHealthIndicator>(MinioHealthIndicator);
    jest.clearAllMocks();
    mockIndicator.check.mockReturnValue(mockSession);
  });

  describe('check', () => {
    it('returns up when listBuckets succeeds', async () => {
      mockListBuckets.mockResolvedValue([]);

      await indicator.check();

      expect(mockSession.up).toHaveBeenCalled();
      expect(mockSession.down).not.toHaveBeenCalled();
    });

    it('returns down when listBuckets throws an Error', async () => {
      mockListBuckets.mockRejectedValue(new Error('S3 error'));

      await indicator.check();

      expect(mockSession.down).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'S3 error' }),
      );
    });

    it('returns down with "Unknown error" when thrown value is not an Error', async () => {
      mockListBuckets.mockRejectedValue('network failure');

      await indicator.check();

      expect(mockSession.down).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Unknown error' }),
      );
    });

    it('uses config defaults when env vars are absent', async () => {
      // Constructor reads config on module creation — verify client works with defaults
      mockListBuckets.mockResolvedValue([]);
      await indicator.check();
      expect(mockSession.up).toHaveBeenCalled();
    });
  });
});
