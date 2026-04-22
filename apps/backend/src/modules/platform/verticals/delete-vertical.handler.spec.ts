import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DeleteVerticalHandler } from './delete-vertical.handler';
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

describe('DeleteVerticalHandler', () => {
  let handler: DeleteVerticalHandler;
  let prisma: { vertical: { delete: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      vertical: { delete: jest.fn().mockResolvedValue(mockVertical) },
    };
    const module = await Test.createTestingModule({
      providers: [
        DeleteVerticalHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    handler = module.get(DeleteVerticalHandler);
  });

  it('deletes a vertical and returns the deleted record', async () => {
    const result = await handler.execute({ id: 'v1' });
    expect(result).toEqual(mockVertical);
    expect(prisma.vertical.delete).toHaveBeenCalledWith({ where: { id: 'v1' } });
  });

  it('throws NotFoundException when vertical does not exist (P2025)', async () => {
    const p2025 = Object.assign(new Error('Record not found'), { code: 'P2025' });
    prisma.vertical.delete.mockRejectedValue(p2025);
    await expect(handler.execute({ id: 'nonexistent' })).rejects.toThrow(NotFoundException);
  });

  it('includes the id in the NotFoundException message', async () => {
    const p2025 = Object.assign(new Error('Record not found'), { code: 'P2025' });
    prisma.vertical.delete.mockRejectedValue(p2025);
    await expect(handler.execute({ id: 'bad-id' })).rejects.toThrow("Vertical 'bad-id' not found");
  });

  it('rethrows unexpected errors without wrapping', async () => {
    const unexpected = new Error('DB timeout');
    prisma.vertical.delete.mockRejectedValue(unexpected);
    await expect(handler.execute({ id: 'v1' })).rejects.toThrow('DB timeout');
  });
});
