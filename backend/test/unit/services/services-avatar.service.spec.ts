/**
 * ServicesAvatarService — Unit Tests
 * Covers: uploadAvatar (not found, old image deletion, skip deletion, success)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ServicesAvatarService } from '../../../src/modules/services/services-avatar.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { MinioService } from '../../../src/common/services/minio.service.js';
import { CacheService } from '../../../src/common/services/cache.service.js';
import { createMockPrisma, createMockCache, mockClinicService } from './services.fixtures.js';

function createMockMinio() {
  return {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };
}

function buildFile(
  mimetype = 'image/jpeg',
  buffer = Buffer.from('img'),
): Express.Multer.File {
  return {
    mimetype,
    buffer,
    fieldname: 'file',
    originalname: 'avatar.jpg',
    encoding: '7bit',
    size: buffer.length,
    destination: '',
    filename: '',
    path: '',
    stream: null as unknown as NodeJS.ReadableStream,
  };
}

async function createModule(
  mockPrisma: ReturnType<typeof createMockPrisma>,
  mockMinio: ReturnType<typeof createMockMinio>,
  mockCache: ReturnType<typeof createMockCache>,
) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ServicesAvatarService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: MinioService, useValue: mockMinio },
      { provide: CacheService, useValue: mockCache },
    ],
  }).compile();
  return module.get<ServicesAvatarService>(ServicesAvatarService);
}

describe('ServicesAvatarService — uploadAvatar', () => {
  let service: ServicesAvatarService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockMinio: ReturnType<typeof createMockMinio>;
  let mockCache: ReturnType<typeof createMockCache>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    mockMinio = createMockMinio();
    mockCache = createMockCache();
    service = await createModule(mockPrisma, mockMinio, mockCache);
    jest.clearAllMocks();
  });

  it('should throw NotFoundException when service does not exist', async () => {
    mockPrisma.service.findFirst.mockResolvedValue(null);

    await expect(
      service.uploadAvatar('non-existent-id', buildFile()),
    ).rejects.toThrow(NotFoundException);

    expect(mockMinio.uploadFile).not.toHaveBeenCalled();
  });

  it('should delete old image from MinIO when service has an existing imageUrl', async () => {
    const existingService = {
      ...mockClinicService,
      imageUrl: 'http://minio.local/carekit/services/service-uuid-1/avatar-old.jpg',
    };
    mockPrisma.service.findFirst.mockResolvedValue(existingService);
    mockMinio.uploadFile.mockResolvedValue('http://minio.local/carekit/services/service-uuid-1/avatar-new.jpg');
    mockPrisma.service.update.mockResolvedValue({
      ...existingService,
      imageUrl: 'http://minio.local/carekit/services/service-uuid-1/avatar-new.jpg',
    });

    await service.uploadAvatar(mockClinicService.id, buildFile());

    expect(mockMinio.deleteFile).toHaveBeenCalledWith(
      'carekit',
      'services/service-uuid-1/avatar-old.jpg',
    );
  });

  it('should skip MinIO deletion when service has no imageUrl', async () => {
    const serviceWithoutImage = { ...mockClinicService, imageUrl: null };
    mockPrisma.service.findFirst.mockResolvedValue(serviceWithoutImage);
    mockMinio.uploadFile.mockResolvedValue('http://minio.local/carekit/services/service-uuid-1/avatar-new.jpg');
    mockPrisma.service.update.mockResolvedValue({
      ...serviceWithoutImage,
      imageUrl: 'http://minio.local/carekit/services/service-uuid-1/avatar-new.jpg',
    });

    await service.uploadAvatar(mockClinicService.id, buildFile());

    expect(mockMinio.deleteFile).not.toHaveBeenCalled();
  });

  it('should upload new file, update imageUrl, and invalidate cache on success', async () => {
    const newImageUrl = 'http://minio.local/carekit/services/service-uuid-1/avatar-123.jpg';
    mockPrisma.service.findFirst.mockResolvedValue({ ...mockClinicService, imageUrl: null });
    mockMinio.uploadFile.mockResolvedValue(newImageUrl);
    mockPrisma.service.update.mockResolvedValue({
      ...mockClinicService,
      imageUrl: newImageUrl,
      iconName: null,
      iconBgColor: null,
    });

    const result = await service.uploadAvatar(mockClinicService.id, buildFile('image/png'));

    expect(mockMinio.uploadFile).toHaveBeenCalledWith(
      'carekit',
      expect.stringMatching(/^services\/service-uuid-1\/avatar-\d+\.png$/),
      expect.any(Buffer),
      'image/png',
    );
    expect(mockPrisma.service.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockClinicService.id },
        data: expect.objectContaining({
          imageUrl: newImageUrl,
          iconName: null,
          iconBgColor: null,
        }),
      }),
    );
    expect(mockCache.del).toHaveBeenCalledWith('cache:services:active');
    expect(result.imageUrl).toBe(newImageUrl);
  });

  it('should continue upload even when MinIO deletion of old image throws', async () => {
    const existingService = {
      ...mockClinicService,
      imageUrl: 'http://minio.local/carekit/services/service-uuid-1/avatar-old.jpg',
    };
    const newImageUrl = 'http://minio.local/carekit/services/service-uuid-1/avatar-new.jpg';
    mockPrisma.service.findFirst.mockResolvedValue(existingService);
    mockMinio.deleteFile.mockRejectedValue(new Error('MinIO unavailable'));
    mockMinio.uploadFile.mockResolvedValue(newImageUrl);
    mockPrisma.service.update.mockResolvedValue({ ...existingService, imageUrl: newImageUrl });

    const result = await service.uploadAvatar(mockClinicService.id, buildFile());

    expect(mockMinio.uploadFile).toHaveBeenCalled();
    expect(result.imageUrl).toBe(newImageUrl);
  });
});
