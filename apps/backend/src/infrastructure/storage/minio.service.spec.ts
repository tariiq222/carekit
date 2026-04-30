import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MinioService } from './minio.service';

const mockClient = {
  bucketExists: jest.fn(),
  makeBucket: jest.fn(),
  putObject: jest.fn(),
  removeObject: jest.fn(),
  presignedGetObject: jest.fn(),
  statObject: jest.fn(),
};

jest.mock('minio', () => ({
  Client: jest.fn().mockImplementation(() => mockClient),
}));

const configMap: Record<string, string | number> = {
  MINIO_ENDPOINT: 'localhost',
  MINIO_PORT: 9000,
  MINIO_ACCESS_KEY: 'access',
  MINIO_SECRET_KEY: 'secret',
  MINIO_BUCKET: 'deqah',
  MINIO_USE_SSL: 'false',
};

const configMapSSL: Record<string, string | number> = {
  MINIO_ENDPOINT: 'localhost',
  MINIO_PORT: 9000,
  MINIO_ACCESS_KEY: 'access',
  MINIO_SECRET_KEY: 'secret',
  MINIO_BUCKET: 'deqah',
  MINIO_USE_SSL: 'true',
};

const mockConfig = {
  getOrThrow: (key: string) => configMap[key],
  get: (key: string) => configMap[key],
};

describe('MinioService', () => {
  let service: MinioService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MinioService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<MinioService>(MinioService);
  });

  describe('onModuleInit', () => {
    it('creates bucket if it does not exist', async () => {
      mockClient.bucketExists.mockResolvedValue(false);
      mockClient.makeBucket.mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(mockClient.bucketExists).toHaveBeenCalledWith('deqah');
      expect(mockClient.makeBucket).toHaveBeenCalledWith('deqah');
    });

    it('skips bucket creation if bucket already exists', async () => {
      mockClient.bucketExists.mockResolvedValue(true);

      await service.onModuleInit();

      expect(mockClient.makeBucket).not.toHaveBeenCalled();
    });
  });

  describe('uploadFile', () => {
    it('returns public URL after upload', async () => {
      mockClient.putObject.mockResolvedValue({ etag: 'abc' });
      const buf = Buffer.from('data');

      const url = await service.uploadFile('deqah', 'test.jpg', buf, 'image/jpeg');

      expect(mockClient.putObject).toHaveBeenCalledWith(
        'deqah', 'test.jpg', buf, buf.length, { 'Content-Type': 'image/jpeg' }
      );
      expect(url).toBe('http://localhost:9000/deqah/test.jpg');
    });
  });

  describe('deleteFile', () => {
    it('calls removeObject', async () => {
      mockClient.removeObject.mockResolvedValue(undefined);

      await service.deleteFile('deqah', 'test.jpg');

      expect(mockClient.removeObject).toHaveBeenCalledWith('deqah', 'test.jpg');
    });
  });

  describe('getSignedUrl', () => {
    it('returns presigned URL with default expiry', async () => {
      mockClient.presignedGetObject.mockResolvedValue('https://signed-url');

      const url = await service.getSignedUrl('deqah', 'test.jpg');

      expect(mockClient.presignedGetObject).toHaveBeenCalledWith('deqah', 'test.jpg', 3600);
      expect(url).toBe('https://signed-url');
    });

    it('uses custom expiry when provided', async () => {
      mockClient.presignedGetObject.mockResolvedValue('https://signed-url-2');

      await service.getSignedUrl('deqah', 'test.jpg', 7200);

      expect(mockClient.presignedGetObject).toHaveBeenCalledWith('deqah', 'test.jpg', 7200);
    });
  });

  describe('fileExists', () => {
    it('returns true when object exists', async () => {
      mockClient.statObject.mockResolvedValue({ size: 100 });

      const result = await service.fileExists('deqah', 'test.jpg');

      expect(result).toBe(true);
    });

    it('returns false when object does not exist', async () => {
      mockClient.statObject.mockRejectedValue(new Error('Not Found'));

      const result = await service.fileExists('deqah', 'test.jpg');

      expect(result).toBe(false);
    });
  });

  describe('SSL', () => {
    it('uses https when MINIO_USE_SSL is true', async () => {
      const sslConfig = {
        getOrThrow: (key: string) => configMapSSL[key],
        get: (key: string) => configMapSSL[key],
      };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MinioService,
          { provide: ConfigService, useValue: sslConfig },
        ],
      }).compile();

      const sslService = module.get<MinioService>(MinioService);
      expect((sslService as unknown as { publicEndpoint: string }).publicEndpoint).toContain('https://');
    });
  });
});
