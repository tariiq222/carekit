import { ForbiddenException } from '@nestjs/common';
import { GetOrgSettingsHandler } from './get-org-settings.handler';
import { UpsertOrgSettingsHandler } from './upsert-org-settings.handler';
import { TenantContextService } from '../../../common/tenant';

const DEFAULT_ORG = '00000000-0000-0000-0000-000000000001';

const mockConfig = {
  id: 'some-uuid',
  organizationId: DEFAULT_ORG,
  companyNameAr: 'Clinic KSA',
  companyNameEn: 'Clinic KSA',
  businessRegistration: null,
  vatRegistrationNumber: null,
  vatRate: 0.15,
  sellerAddress: null,
  organizationCity: 'Riyadh',
  postalCode: null,
  contactPhone: null,
  contactEmail: null,
  address: null,
  socialMedia: null,
  aboutAr: null,
  aboutEn: null,
  privacyPolicyAr: null,
  privacyPolicyEn: null,
  termsAr: null,
  termsEn: null,
  cancellationPolicyAr: null,
  cancellationPolicyEn: null,
  defaultLanguage: 'ar',
  timezone: 'Asia/Riyadh',
  weekStartDay: 'sunday',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '12h',
  emailHeaderShowLogo: true,
  emailHeaderShowName: true,
  emailFooterPhone: null,
  emailFooterWebsite: null,
  emailFooterInstagram: null,
  emailFooterTwitter: null,
  emailFooterSnapchat: null,
  emailFooterTiktok: null,
  emailFooterLinkedin: null,
  emailFooterYoutube: null,
  sessionDuration: 60,
  reminderBeforeMinutes: 60,
  bookingFlowOrder: 'service_first',
  paymentMoyasarEnabled: true,
  paymentAtClinicEnabled: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const buildPrisma = () => ({
  organizationSettings: {
    upsert: jest.fn().mockResolvedValue(mockConfig),
  },
});

const buildTenant = (organizationId = DEFAULT_ORG, isSuperAdmin = false) =>
  ({
    requireOrganizationId: jest.fn().mockReturnValue(organizationId),
    requireOrganizationIdOrDefault: jest.fn().mockReturnValue(organizationId),
    isSuperAdmin: jest.fn().mockReturnValue(isSuperAdmin),
  }) as unknown as TenantContextService;

describe('GetOrgSettingsHandler', () => {
  it('returns the org-scoped row via upsert-on-read', async () => {
    const prisma = buildPrisma();
    const handler = new GetOrgSettingsHandler(prisma as never, buildTenant());
    await handler.execute();
    expect(prisma.organizationSettings.upsert).toHaveBeenCalledWith({
      where: { organizationId: DEFAULT_ORG },
      create: expect.objectContaining({ organizationId: DEFAULT_ORG }),
      update: {},
    });
  });
});

describe('UpsertOrgSettingsHandler', () => {
  it('upserts settings scoped by organizationId', async () => {
    const prisma = buildPrisma();
    const handler = new UpsertOrgSettingsHandler(prisma as never, buildTenant());
    const dto = { companyNameAr: 'New Clinic' };
    await handler.execute(dto);
    expect(prisma.organizationSettings.upsert).toHaveBeenCalledWith({
      where: { organizationId: DEFAULT_ORG },
      create: expect.objectContaining({ organizationId: DEFAULT_ORG, companyNameAr: 'New Clinic' }),
      update: { companyNameAr: 'New Clinic' },
    });
  });

  it('two orgs can have different settings simultaneously', async () => {
    const prismaA = buildPrisma();
    const prismaB = buildPrisma();
    const handlerA = new UpsertOrgSettingsHandler(prismaA as never, buildTenant('org-A'));
    const handlerB = new UpsertOrgSettingsHandler(prismaB as never, buildTenant('org-B'));
    await handlerA.execute({ companyNameAr: 'عيادة أ' });
    await handlerB.execute({ companyNameAr: 'عيادة ب' });
    expect(prismaA.organizationSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-A' } }),
    );
    expect(prismaB.organizationSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-B' } }),
    );
  });
});

describe('vatRate (super-admin gate)', () => {
  it('GetOrgSettings returns vatRate', async () => {
    const configWithVat = { ...mockConfig, vatRate: 0.15 };
    const prisma = {
      organizationSettings: {
        upsert: jest.fn().mockResolvedValue(configWithVat),
      },
    };
    const handler = new GetOrgSettingsHandler(prisma as never, buildTenant());
    const result = await handler.execute();
    expect(result).toHaveProperty('vatRate', 0.15);
  });

  it('UpsertOrgSettings allows vatRate change for super-admin', async () => {
    const prisma = buildPrisma();
    const handler = new UpsertOrgSettingsHandler(prisma as never, buildTenant(DEFAULT_ORG, true));
    await handler.execute({ vatRate: 0.05 });
    expect(prisma.organizationSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ vatRate: 0.05 }),
      }),
    );
  });

  it('UpsertOrgSettings rejects vatRate change for non-super-admin', async () => {
    const prisma = buildPrisma();
    const handler = new UpsertOrgSettingsHandler(prisma as never, buildTenant(DEFAULT_ORG, false));
    await expect(handler.execute({ vatRate: 0.05 })).rejects.toThrow(ForbiddenException);
    expect(prisma.organizationSettings.upsert).not.toHaveBeenCalled();
  });

  it('UpsertOrgSettings allows other field changes for non-super-admin (no vatRate field)', async () => {
    const prisma = buildPrisma();
    const handler = new UpsertOrgSettingsHandler(prisma as never, buildTenant(DEFAULT_ORG, false));
    await expect(handler.execute({ companyNameAr: 'Test Clinic' })).resolves.not.toThrow();
    expect(prisma.organizationSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ companyNameAr: 'Test Clinic' }),
      }),
    );
  });
});
