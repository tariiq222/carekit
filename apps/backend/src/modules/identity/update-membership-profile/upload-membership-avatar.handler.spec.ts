import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadMembershipAvatarHandler } from './upload-membership-avatar.handler';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';

// ── Magic-byte fixtures ──────────────────────────────────────────────────────

/** Valid PNG signature (8 bytes) + body */
const PNG_BUFFER = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('png-body'),
]);

/** Valid JPEG: SOI + JFIF marker */
const JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
  0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

/** MP4 ftyp box — should be rejected for avatar */
const MP4_BUFFER = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
  0x6d, 0x70, 0x34, 0x32, 0x00, 0x00, 0x00, 0x00,
  0x6d, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6f, 0x6d,
]);

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

  it('uploads PNG to memberships/{id}/avatar-{ts}.png and updates Membership.avatarUrl', async () => {
    prisma.membership.findUnique.mockResolvedValue({ id: 'm-1', userId: 'user-1', isActive: true });

    const out = await handler.execute({
      userId: 'user-1',
      membershipId: 'm-1',
      filename: 'photo.png',
      mimetype: 'image/png',
      buffer: PNG_BUFFER,
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

  it('uploads JPEG to memberships/{id}/avatar-{ts}.jpg', async () => {
    prisma.membership.findUnique.mockResolvedValue({ id: 'm-2', userId: 'user-1', isActive: true });

    const out = await handler.execute({
      userId: 'user-1',
      membershipId: 'm-2',
      filename: 'photo.jpg',
      mimetype: 'image/jpeg',
      buffer: JPEG_BUFFER,
    });

    expect(out.membershipId).toBe('m-2');
    const uploadCall = storage.uploadFile.mock.calls[0]!;
    expect(uploadCall[1]).toMatch(/^memberships\/m-2\/avatar-\d+\.jpg$/);
  });

  it('rejects MP4 bytes claimed as image/png (magic-byte mismatch)', async () => {
    prisma.membership.findUnique.mockResolvedValue({ id: 'm-1', userId: 'user-1', isActive: true });
    await expect(
      handler.execute({
        userId: 'user-1',
        membershipId: 'm-1',
        filename: 'evil.png',
        mimetype: 'image/png',
        buffer: MP4_BUFFER,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(storage.uploadFile).not.toHaveBeenCalled();
  });

  it('rejects PNG bytes claimed as image/jpeg (magic-byte mismatch)', async () => {
    prisma.membership.findUnique.mockResolvedValue({ id: 'm-1', userId: 'user-1', isActive: true });
    await expect(
      handler.execute({
        userId: 'user-1',
        membershipId: 'm-1',
        filename: 'spoof.jpg',
        mimetype: 'image/jpeg',
        buffer: PNG_BUFFER,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(storage.uploadFile).not.toHaveBeenCalled();
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
        buffer: PNG_BUFFER,
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
        buffer: PNG_BUFFER,
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
