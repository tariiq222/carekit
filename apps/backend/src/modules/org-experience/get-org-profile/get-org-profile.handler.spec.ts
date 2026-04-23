import { Test, TestingModule } from '@nestjs/testing';
import { GetOrgProfileHandler, OrgProfileDto } from './get-org-profile.handler';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';

describe('GetOrgProfileHandler', () => {
  let handler: GetOrgProfileHandler;
  let prisma: PrismaService;
  let tenant: TenantContextService;

  const mockOrg = {
    nameAr: 'عيادة النجاح',
    nameEn: 'Al-Najah Clinic',
    slug: 'al-najah-clinic',
  };

  const mockBranding = {
    productTagline: 'Healthcare excellence',
    logoUrl: 'https://cdn.example.com/logo.png',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetOrgProfileHandler,
        {
          provide: PrismaService,
          useValue: {
            organization: {
              findUniqueOrThrow: jest.fn().mockResolvedValue(mockOrg),
            },
            brandingConfig: {
              upsert: jest.fn().mockResolvedValue(mockBranding),
            },
          },
        },
        {
          provide: TenantContextService,
          useValue: {
            requireOrganizationIdOrDefault: jest.fn().mockReturnValue('org-123'),
          },
        },
      ],
    }).compile();

    handler = module.get<GetOrgProfileHandler>(GetOrgProfileHandler);
    prisma = module.get<PrismaService>(PrismaService);
    tenant = module.get<TenantContextService>(TenantContextService);
  });

  it('should return merged org profile from Organization and BrandingConfig', async () => {
    const result = await handler.execute();

    expect(result).toEqual<OrgProfileDto>({
      nameAr: mockOrg.nameAr,
      nameEn: mockOrg.nameEn,
      slug: mockOrg.slug,
      tagline: mockBranding.productTagline,
      logoUrl: mockBranding.logoUrl,
    });
    expect(prisma.organization.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'org-123' },
      select: { nameAr: true, nameEn: true, slug: true },
    });
  });

  it('should upsert BrandingConfig if missing', async () => {
    const upsertMock = jest
      .fn()
      .mockResolvedValueOnce(mockBranding)
      .mockResolvedValueOnce({ productTagline: null, logoUrl: null });

    prisma.brandingConfig.upsert = upsertMock as any;

    await handler.execute();

    expect(prisma.brandingConfig.upsert).toHaveBeenCalledWith({
      where: { organizationId: 'org-123' },
      create: { organizationId: 'org-123', organizationNameAr: mockOrg.nameAr },
      update: {},
    });
  });
});