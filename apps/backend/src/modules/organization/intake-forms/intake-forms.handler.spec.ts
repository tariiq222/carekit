import { NotFoundException } from '@nestjs/common';
import { CreateIntakeFormHandler } from './create-intake-form.handler';
import { GetIntakeFormHandler } from './get-intake-form.handler';
import { ListIntakeFormsHandler } from './list-intake-forms.handler';

const mockForm = {
  id: 'form-1',
  tenantId: 'tenant-1',
  nameAr: 'استمارة المريض',
  nameEn: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  fields: [],
};

const buildPrisma = () => ({
  intakeForm: {
    create: jest.fn().mockResolvedValue(mockForm),
    findFirst: jest.fn().mockResolvedValue(mockForm),
    findMany: jest.fn().mockResolvedValue([mockForm]),
  },
});

describe('CreateIntakeFormHandler', () => {
  it('creates form without fields', async () => {
    const prisma = buildPrisma();
    const handler = new CreateIntakeFormHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1', nameAr: 'استمارة المريض' });
    expect(result.id).toBe('form-1');
  });
});

describe('GetIntakeFormHandler', () => {
  it('returns form with fields', async () => {
    const prisma = buildPrisma();
    const handler = new GetIntakeFormHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1', formId: 'form-1' });
    expect(result.nameAr).toBe('استمارة المريض');
  });

  it('throws NotFoundException when form not found', async () => {
    const prisma = buildPrisma();
    prisma.intakeForm.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new GetIntakeFormHandler(prisma as never);
    await expect(handler.execute({ tenantId: 'tenant-1', formId: 'missing' })).rejects.toThrow(NotFoundException);
  });
});

describe('ListIntakeFormsHandler', () => {
  it('returns all forms for tenant', async () => {
    const prisma = buildPrisma();
    const handler = new ListIntakeFormsHandler(prisma as never);
    const result = await handler.execute({ tenantId: 'tenant-1' });
    expect(result).toHaveLength(1);
  });
});
