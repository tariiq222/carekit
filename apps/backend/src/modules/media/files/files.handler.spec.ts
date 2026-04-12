import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FileVisibility } from '@prisma/client';
import { UploadFileHandler } from './upload-file.handler';
import { GetFileHandler } from './get-file.handler';
import { DeleteFileHandler } from './delete-file.handler';
import { GeneratePresignedUrlHandler } from './generate-presigned-url.handler';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';

const mockFile = {
  id: 'f1',
  tenantId: 'tenant-1',
  bucket: 'carekit',
  storageKey: 'tenant-1/abc.png',
  filename: 'photo.png',
  mimetype: 'image/png',
  size: 12,
  visibility: FileVisibility.PRIVATE,
  ownerType: null,
  ownerId: null,
  uploadedBy: null,
  isDeleted: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Media files handlers', () => {
  let uploadHandler: UploadFileHandler;
  let getHandler: GetFileHandler;
  let deleteHandler: DeleteFileHandler;
  let presignHandler: GeneratePresignedUrlHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let storage: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UploadFileHandler,
        GetFileHandler,
        DeleteFileHandler,
        GeneratePresignedUrlHandler,
        {
          provide: PrismaService,
          useValue: {
            file: {
              create: jest.fn().mockResolvedValue(mockFile),
              findFirst: jest.fn().mockResolvedValue(mockFile),
              update: jest.fn().mockResolvedValue({ ...mockFile, isDeleted: true }),
            },
          },
        },
        {
          provide: MinioService,
          useValue: {
            uploadFile: jest.fn().mockResolvedValue('http://minio/carekit/key'),
            deleteFile: jest.fn().mockResolvedValue(undefined),
            getSignedUrl: jest.fn().mockResolvedValue('http://minio/signed?token=xyz'),
          },
        },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('carekit') },
        },
      ],
    }).compile();

    uploadHandler = module.get(UploadFileHandler);
    getHandler = module.get(GetFileHandler);
    deleteHandler = module.get(DeleteFileHandler);
    presignHandler = module.get(GeneratePresignedUrlHandler);
    prisma = module.get(PrismaService);
    storage = module.get(MinioService);
  });

  describe('upload-file', () => {
    it('uploads buffer and persists metadata', async () => {
      const buffer = Buffer.from('hello world!');
      const result = await uploadHandler.execute(
        {
          tenantId: 'tenant-1',
          filename: 'photo.png',
          mimetype: 'image/png',
          size: buffer.length,
        },
        buffer,
      );
      expect(storage.uploadFile).toHaveBeenCalledTimes(1);
      expect(prisma.file.create).toHaveBeenCalledTimes(1);
      const createArg = prisma.file.create.mock.calls[0][0].data;
      expect(createArg.tenantId).toBe('tenant-1');
      expect(createArg.bucket).toBe('carekit');
      expect(createArg.storageKey).toMatch(/^tenant-1\/.+\.png$/);
      expect(result).toEqual(mockFile);
    });

    it('rejects empty buffer', async () => {
      await expect(
        uploadHandler.execute(
          { tenantId: 't', filename: 'a.txt', mimetype: 'text/plain', size: 0 },
          Buffer.alloc(0),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects size mismatch', async () => {
      await expect(
        uploadHandler.execute(
          { tenantId: 't', filename: 'a.txt', mimetype: 'text/plain', size: 99 },
          Buffer.from('hi'),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects files over the size limit', async () => {
      const big = Buffer.alloc(26 * 1024 * 1024, 0);
      await expect(
        uploadHandler.execute(
          { tenantId: 't', filename: 'big.pdf', mimetype: 'application/pdf', size: big.length },
          big,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects disallowed mime types', async () => {
      const buffer = Buffer.from('MZ');
      await expect(
        uploadHandler.execute(
          { tenantId: 't', filename: 'evil.exe', mimetype: 'application/x-msdownload', size: buffer.length },
          buffer,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('get-file', () => {
    it('returns file by id scoped to tenant', async () => {
      const result = await getHandler.execute('tenant-1', 'f1');
      expect(prisma.file.findFirst).toHaveBeenCalledWith({
        where: { id: 'f1', tenantId: 'tenant-1', isDeleted: false },
      });
      expect(result).toEqual(mockFile);
    });

    it('throws NotFound when missing', async () => {
      prisma.file.findFirst.mockResolvedValueOnce(null);
      await expect(getHandler.execute('tenant-1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('delete-file', () => {
    it('removes object from storage and soft-deletes row', async () => {
      const result = await deleteHandler.execute('tenant-1', 'f1');
      expect(storage.deleteFile).toHaveBeenCalledWith('carekit', 'tenant-1/abc.png');
      expect(prisma.file.update).toHaveBeenCalledWith({
        where: { id: 'f1' },
        data: { isDeleted: true },
      });
      expect(result.isDeleted).toBe(true);
    });

    it('throws NotFound when file missing', async () => {
      prisma.file.findFirst.mockResolvedValueOnce(null);
      await expect(deleteHandler.execute('tenant-1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.deleteFile).not.toHaveBeenCalled();
    });
  });

  describe('generate-presigned-url', () => {
    it('returns signed url with default expiry', async () => {
      const result = await presignHandler.execute({ tenantId: 'tenant-1', fileId: 'f1' });
      expect(storage.getSignedUrl).toHaveBeenCalledWith('carekit', 'tenant-1/abc.png', 3600);
      expect(result.url).toBe('http://minio/signed?token=xyz');
      expect(result.expiresInSeconds).toBe(3600);
    });

    it('honors custom expiry', async () => {
      await presignHandler.execute({ tenantId: 'tenant-1', fileId: 'f1', expirySeconds: 600 });
      expect(storage.getSignedUrl).toHaveBeenCalledWith('carekit', 'tenant-1/abc.png', 600);
    });

    it('throws NotFound when file missing', async () => {
      prisma.file.findFirst.mockResolvedValueOnce(null);
      await expect(
        presignHandler.execute({ tenantId: 'tenant-1', fileId: 'missing' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
