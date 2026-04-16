import { GetOrgSettingsHandler } from './get-org-settings.handler';
import { UpsertOrgSettingsHandler } from './upsert-org-settings.handler';

const mockConfig = {
  id: 'default',
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

describe('GetOrgSettingsHandler', () => {
  it('returns the singleton row, creating it on first call', async () => {
    const prisma = buildPrisma();
    const handler = new GetOrgSettingsHandler(prisma as never);
    const result = await handler.execute();
    expect(prisma.organizationSettings.upsert).toHaveBeenCalledWith({
      where: { id: 'default' },
      create: expect.objectContaining({ id: 'default' }),
      update: {},
    });
    expect(result.id).toBe('default');
  });
});

describe('UpsertOrgSettingsHandler', () => {
  it('upserts singleton config with id=default', async () => {
    const prisma = buildPrisma();
    const handler = new UpsertOrgSettingsHandler(prisma as never);
    const dto = { companyNameAr: 'New Clinic' };
    const result = await handler.execute(dto);
    expect(prisma.organizationSettings.upsert).toHaveBeenCalledWith({
      where: { id: 'default' },
      create: expect.objectContaining({ id: 'default', companyNameAr: 'New Clinic' }),
      update: { companyNameAr: 'New Clinic' },
    });
    expect(result.id).toBe('default');
  });
});