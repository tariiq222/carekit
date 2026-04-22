import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UpdateVerticalHandler } from './update-vertical.handler';
import { PrismaService } from '../../../infrastructure/database';
import { TemplateFamily } from '@prisma/client';

const mockVertical = {
  id: 'v1',
  slug: 'medical',
  nameAr: 'طبي',
  nameEn: 'Medical',
  templateFamily: TemplateFamily.MEDICAL,
  descriptionAr: null,
  descriptionEn: null,
  iconUrl: null,
  sortOrder: 0,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UpdateVerticalHandler', () => {
  let handler: UpdateVerticalHandler;
  let prisma: { vertical: { update: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      vertical: { update: jest.fn().mockResolvedValue({ ...mockVertical, nameEn: 'Updated Medical' }) },
    };
    const module = await Test.createTestingModule({
      providers: [
        UpdateVerticalHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    handler = module.get(UpdateVerticalHandler);
  });

  it('updates a vertical with only the provided fields', async () => {
    const result = await handler.execute({ id: 'v1', nameEn: 'Updated Medical' });
    expect(result.nameEn).toBe('Updated Medical');
    expect(prisma.vertical.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { nameEn: 'Updated Medical' },
    });
  });

  it('does not include undefined fields in the update data', async () => {
    await handler.execute({ id: 'v1', isActive: false });
    const callData = prisma.vertical.update.mock.calls[0][0].data;
    expect(Object.keys(callData)).toEqual(['isActive']);
    expect(callData.isActive).toBe(false);
  });

  it('throws NotFoundException when vertical does not exist (P2025)', async () => {
    const p2025 = Object.assign(new Error('Record not found'), { code: 'P2025' });
    prisma.vertical.update.mockRejectedValue(p2025);
    await expect(handler.execute({ id: 'nonexistent', nameEn: 'X' })).rejects.toThrow(NotFoundException);
  });

  it('rethrows unexpected errors', async () => {
    const unexpected = new Error('DB connection lost');
    prisma.vertical.update.mockRejectedValue(unexpected);
    await expect(handler.execute({ id: 'v1', nameEn: 'X' })).rejects.toThrow('DB connection lost');
  });

  it('passes multiple fields when all provided', async () => {
    await handler.execute({ id: 'v1', nameAr: 'جديد', nameEn: 'New', sortOrder: 3 });
    const callData = prisma.vertical.update.mock.calls[0][0].data;
    expect(callData).toEqual({ nameAr: 'جديد', nameEn: 'New', sortOrder: 3 });
  });
});
