import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { UpdateOrgProfileHandler } from './update-org-profile.handler';
import { UpdateOrgProfileDto } from './update-org-profile.dto';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';

describe('UpdateOrgProfileHandler', () => {
  let handler: UpdateOrgProfileHandler;
  let prisma: PrismaService;
  let tenant: TenantContextService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateOrgProfileHandler,
        {
          provide: PrismaService,
          useValue: {
            organization: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            brandingConfig: {
              upsert: jest.fn(),
            },
            $transaction: jest.fn((fn) => fn(prisma)),
          },
        },
        {
          provide: TenantContextService,
          useValue: {
            requireOrganizationId: jest.fn().mockReturnValue('org-123'),
          },
        },
      ],
    }).compile();

    handler = module.get<UpdateOrgProfileHandler>(UpdateOrgProfileHandler);
    prisma = module.get<PrismaService>(PrismaService);
    tenant = module.get<TenantContextService>(TenantContextService);
  });

  it('should update org and sync BrandingConfig atomically', async () => {
    prisma.organization.findUnique = jest.fn().mockResolvedValue(null);

    const dto: UpdateOrgProfileDto = {
      nameAr: 'عيادة جديدة',
      nameEn: 'New Clinic',
      slug: 'new-clinic',
      tagline: 'New tagline',
    };

    await handler.execute(dto);

    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: 'org-123' },
      data: { nameAr: 'عيادة جديدة', nameEn: 'New Clinic', slug: 'new-clinic' },
    });
    expect(prisma.brandingConfig.upsert).toHaveBeenCalledWith({
      where: { organizationId: 'org-123' },
      create: {
        organizationId: 'org-123',
        organizationNameAr: 'عيادة جديدة',
        organizationNameEn: 'New Clinic',
        productTagline: 'New tagline',
      },
      update: {
        organizationNameAr: 'عيادة جديدة',
        organizationNameEn: 'New Clinic',
        productTagline: 'New tagline',
      },
    });
  });

  it('should throw ConflictException when slug is taken by another org', async () => {
    prisma.organization.findUnique = jest.fn().mockResolvedValue({ id: 'other-org' });

    const dto: UpdateOrgProfileDto = { slug: 'taken-slug' };

    await expect(handler.execute(dto)).rejects.toThrow(ConflictException);
    await expect(handler.execute(dto)).rejects.toMatchObject({
      message: 'SLUG_TAKEN',
    });
  });

  it('should allow slug update when org owns the slug', async () => {
    prisma.organization.findUnique = jest.fn().mockResolvedValue({ id: 'org-123' });

    const dto: UpdateOrgProfileDto = { slug: 'my-current-slug' };

    await handler.execute(dto);

    expect(prisma.organization.update).toHaveBeenCalled();
  });
});