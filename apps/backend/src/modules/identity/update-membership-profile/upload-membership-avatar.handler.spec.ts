import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadMembershipAvatarHandler } from './upload-membership-avatar.handler';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';

describe('UploadMembershipAvatarHandler', () => {
  let handler: UploadMembershipAvatarHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;
  let storage: jest.Mocked<MinioService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UploadMembershipAvatarHandler,
        {
          provide: PrismaService,
          useValue: {
            membership: {
              findUnique: jest.fn(),
              update: jest.fn().mockResolvedValue({}),
            },
          } as unknown as PrismaService,
        },
        {
          provide: MinioService,
          useValue: {
            uploadFile: jest.fn().mockResolvedValue('https://minio.example.com/path/avatar.jpg'),
          },
        },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('deqah-files') },
        },
      ],
    }).compile();

    handler = module.get(UploadMembershipAvatarHandler);
    prisma = module.get(PrismaService);
    storage = module.get(MinioService);
  });

  it('uploads to memberships/{id}/avatar-{ts}.{ext} and updates Membership.avatarUrl', async () => {
    prisma.membership.findUnique.mockResolvedValue({ id: 'm-1', userId: 'user-1', isActive: true });

    const out = await handler.execute({
      userId: 'user-1',
      membershipId: 'm-1',
      filename: 'photo.png',
      mimetype: 'image/png',
      buffer: Buffer.from('img'),
    });

    expect(out.avatarUrl).toBe('https://minio.example.com/path/avatar.jpg');
    const uploadCall = storage.uploadFile.mock.calls[0]!;
    expect(uploadCall[0]).toBe('deqah-files');
    expect(uploadCall[1]).toMatch(/^memberships\/m-1\/avatar-\d+\.png$/);
    expect(prisma.membership.update).toHaveBeenCalledWith({
      where: { id: 'm-1' },
      data: { avatarUrl: 'https://minio.example.com/path/avatar.jpg' },
    });
  });

  it('rejects when caller does not own the membership', async () => {
    prisma.membership.findUnique.mockResolvedValue({
      id: 'm-1',
      userId: 'someone-else',
      isActive: true,
    });
    await expect(
      handler.execute({
        userId: 'user-1',
        membershipId: 'm-1',
        filename: 'photo.png',
        mimetype: 'image/png',
        buffer: Buffer.from('img'),
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(storage.uploadFile).not.toHaveBeenCalled();
  });

  it('throws NotFoundException for missing membership', async () => {
    prisma.membership.findUnique.mockResolvedValue(null);
    await expect(
      handler.execute({
        userId: 'user-1',
        membershipId: 'missing',
        filename: 'photo.png',
        mimetype: 'image/png',
        buffer: Buffer.from('img'),
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects disallowed mime types', async () => {
    prisma.membership.findUnique.mockResolvedValue({ id: 'm-1', userId: 'user-1', isActive: true });
    await expect(
      handler.execute({
        userId: 'user-1',
        membershipId: 'm-1',
        filename: 'doc.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('pdf'),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects oversized files', async () => {
    prisma.membership.findUnique.mockResolvedValue({ id: 'm-1', userId: 'user-1', isActive: true });
    await expect(
      handler.execute({
        userId: 'user-1',
        membershipId: 'm-1',
        filename: 'big.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.alloc(6 * 1024 * 1024),
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
