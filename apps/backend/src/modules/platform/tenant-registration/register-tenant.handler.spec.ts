import { ConflictException, NotFoundException } from '@nestjs/common';
import { RegisterTenantHandler } from './register-tenant.handler';

// ── Minimal prisma mock ──────────────────────────────────────────────────────
const makePrisma = (overrides: Record<string, unknown> = {}) => ({
  $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(txMock)),
  plan: { findFirst: jest.fn().mockResolvedValue({ id: 'plan-1', isActive: true }) },
  subscription: { findFirst: jest.fn().mockResolvedValue(null) },
  organization: { count: jest.fn().mockResolvedValue(0) },
  user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'user-1', email: 'a@b.com', role: 'ADMIN', customRoleId: null, customRole: null }) },
  ...overrides,
});

const txMock = {
  organization: { 
    create: jest.fn().mockResolvedValue({ id: 'org-1' }),
    count: jest.fn().mockResolvedValue(0),
  },
  user: { create: jest.fn().mockResolvedValue({ id: 'user-1', email: 'a@b.com', role: 'ADMIN', customRoleId: null, customRole: null }) },
  membership: { create: jest.fn().mockResolvedValue({ id: 'mem-1', organizationId: 'org-1' }) },
  brandingConfig: { create: jest.fn().mockResolvedValue({}) },
  organizationSettings: { create: jest.fn().mockResolvedValue({}) },
};

const makePassword = () => ({ hash: jest.fn().mockResolvedValue('hashed') });
const makeTokens = () => ({ issueTokenPair: jest.fn().mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' }) });
const makeConfig = (slug = 'BASIC', trialDays = 14) => ({
  get: jest.fn().mockImplementation((key: string, def: unknown) => {
    if (key === 'PLATFORM_DEFAULT_PLAN_SLUG') return slug;
    if (key === 'SAAS_TRIAL_DAYS') return trialDays;
    return def;
  }),
});
const makeTenant = () => ({ set: jest.fn(), requireOrganizationId: jest.fn().mockReturnValue('org-1') });
const makeCache = () => ({ invalidate: jest.fn() });
const makeStartSub = () => ({ execute: jest.fn().mockResolvedValue({ id: 'sub-1' }) });

describe('RegisterTenantHandler', () => {
  let handler: RegisterTenantHandler;
  let prisma: ReturnType<typeof makePrisma>;
  let tokens: ReturnType<typeof makeTokens>;
  let startSub: ReturnType<typeof makeStartSub>;
  let tenant: ReturnType<typeof makeTenant>;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = makePrisma();
    tokens = makeTokens();
    startSub = makeStartSub();
    tenant = makeTenant();
    handler = new RegisterTenantHandler(
      prisma as never,
      makePassword() as never,
      tokens as never,
      makeConfig() as never,
      tenant as never,
      makeCache() as never,
      startSub as never,
    );
  });

  it('throws ConflictException when email already exists (P2002 on user.email)', async () => {
    const txConflict = { ...txMock, user: { create: jest.fn().mockRejectedValue({ code: 'P2002', meta: { target: ['email'] }, message: 'Unique constraint failed on email' }) } };
    prisma.$transaction = jest.fn(async (cb) => cb(txConflict));
    await expect(handler.execute({ name: 'Ali', email: 'a@b.com', phone: '0501234567', password: 'Pass@1234', businessNameAr: 'عيادة' }))
      .rejects.toThrow(ConflictException);
  });

  it('throws NotFoundException when default plan not found', async () => {
    prisma.plan.findFirst = jest.fn().mockResolvedValue(null);
    await expect(handler.execute({ name: 'Ali', email: 'new@b.com', phone: '0501234567', password: 'Pass@1234', businessNameAr: 'عيادة' }))
      .rejects.toThrow(NotFoundException);
  });

  it('creates org + user + membership + branding + settings inside one transaction', async () => {
    await handler.execute({ name: 'Ali', email: 'new@b.com', phone: '0501234567', password: 'Pass@1234', businessNameAr: 'عيادة علي' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.organization.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'TRIALING', nameAr: 'عيادة علي' }),
    }));
    expect(txMock.membership.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ role: 'OWNER', isActive: true }),
    }));
    expect(txMock.brandingConfig.create).toHaveBeenCalled();
    expect(txMock.organizationSettings.create).toHaveBeenCalled();
  });

  it('calls StartSubscriptionHandler.execute after transaction', async () => {
    await handler.execute({ name: 'Ali', email: 'new@b.com', phone: '0501234567', password: 'Pass@1234', businessNameAr: 'عيادة' });
    expect(startSub.execute).toHaveBeenCalledWith(expect.objectContaining({ billingCycle: 'MONTHLY' }));
  });

  it('returns accessToken, refreshToken, and userId', async () => {
    const result = await handler.execute({ name: 'Ali', email: 'new@b.com', phone: '0501234567', password: 'Pass@1234', businessNameAr: 'عيادة' });
    expect(result).toMatchObject({ accessToken: 'at', refreshToken: 'rt', userId: 'user-1' });
  });
});
