import { Test } from '@nestjs/testing';
import { CreateVerticalHandler } from './create-vertical.handler';
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

describe('CreateVerticalHandler', () => {
  let handler: CreateVerticalHandler;
  let prisma: { vertical: { create: jest.Mock } };

  beforeEach(async () => {
    prisma = { vertical: { create: jest.fn().mockResolvedValue(mockVertical) } };
    const module = await Test.createTestingModule({
      providers: [
        CreateVerticalHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    handler = module.get(CreateVerticalHandler);
  });

  it('creates a vertical with all required fields', async () => {
    const result = await handler.execute({
      slug: 'medical',
      nameAr: 'طبي',
      nameEn: 'Medical',
      templateFamily: TemplateFamily.MEDICAL,
    });
    expect(result).toEqual(mockVertical);
    expect(prisma.vertical.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        slug: 'medical',
        nameAr: 'طبي',
        nameEn: 'Medical',
        templateFamily: TemplateFamily.MEDICAL,
        isActive: true,
        sortOrder: 0,
      }),
    });
  });

  it('defaults isActive to true when not provided', async () => {
    await handler.execute({
      slug: 'medical',
      nameAr: 'طبي',
      nameEn: 'Medical',
      templateFamily: TemplateFamily.MEDICAL,
    });
    const callData = prisma.vertical.create.mock.calls[0][0].data;
    expect(callData.isActive).toBe(true);
  });

  it('defaults sortOrder to 0 when not provided', async () => {
    await handler.execute({
      slug: 'medical',
      nameAr: 'طبي',
      nameEn: 'Medical',
      templateFamily: TemplateFamily.MEDICAL,
    });
    const callData = prisma.vertical.create.mock.calls[0][0].data;
    expect(callData.sortOrder).toBe(0);
  });

  it('uses provided isActive and sortOrder when given', async () => {
    await handler.execute({
      slug: 'medical',
      nameAr: 'طبي',
      nameEn: 'Medical',
      templateFamily: TemplateFamily.MEDICAL,
      isActive: false,
      sortOrder: 5,
    });
    const callData = prisma.vertical.create.mock.calls[0][0].data;
    expect(callData.isActive).toBe(false);
    expect(callData.sortOrder).toBe(5);
  });

  it('forwards optional fields when provided', async () => {
    await handler.execute({
      slug: 'medical',
      nameAr: 'طبي',
      nameEn: 'Medical',
      templateFamily: TemplateFamily.MEDICAL,
      descriptionAr: 'وصف',
      descriptionEn: 'Description',
      iconUrl: 'https://example.com/icon.svg',
    });
    const callData = prisma.vertical.create.mock.calls[0][0].data;
    expect(callData.descriptionAr).toBe('وصف');
    expect(callData.descriptionEn).toBe('Description');
    expect(callData.iconUrl).toBe('https://example.com/icon.svg');
  });
});
