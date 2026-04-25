import { NotFoundException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ZatcaSubmissionStatus } from '@prisma/client';
import { ZatcaSubmitHandler } from './zatca-submit.handler';

const DEFAULT_ORG = '00000000-0000-0000-0000-000000000001';

const mockInvoice = {
  id: 'inv-1', status: 'PAID',
  total: 230, vatAmt: 30, issuedAt: new Date('2026-01-01'),
};
const mockSubmission = {
  id: 'sub-1', invoiceId: 'inv-1',
  status: ZatcaSubmissionStatus.ACCEPTED, zatcaUuid: 'zatca-uuid-1', qrCode: 'qr-code',
};

const buildPrisma = () => ({
  invoice: { findFirst: jest.fn().mockResolvedValue(mockInvoice) },
  zatcaSubmission: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ ...mockSubmission, status: ZatcaSubmissionStatus.PENDING }),
    update: jest.fn().mockResolvedValue(mockSubmission),
  },
});

const buildConfig = (overrides: Record<string, string | undefined> = {}) => ({
  get: jest.fn((key: string) => ({
    ZATCA_API_URL: undefined,
    ZATCA_API_KEY: undefined,
    ZATCA_ENABLED: 'true',
    ...overrides,
  }[key])),
});

const buildTenant = (organizationId = DEFAULT_ORG) =>
  ({
    requireOrganizationId: jest.fn().mockReturnValue(organizationId),
    requireOrganizationIdOrDefault: jest.fn().mockReturnValue(organizationId),
  }) as never;

const cmd = { invoiceId: 'inv-1' };

describe('ZatcaSubmitHandler', () => {
  it('throws ServiceUnavailableException when ZATCA_ENABLED is not "true"', async () => {
    const prisma = buildPrisma();
    const handler = new ZatcaSubmitHandler(
      prisma as never,
      buildConfig({ ZATCA_ENABLED: 'false' }) as never,
      buildTenant(),
    );
    await expect(handler.execute(cmd)).rejects.toThrow(ServiceUnavailableException);
    expect(prisma.invoice.findFirst).not.toHaveBeenCalled();
  });

  it('creates submission and returns updated record', async () => {
    const prisma = buildPrisma();
    const handler = new ZatcaSubmitHandler(prisma as never, buildConfig() as never, buildTenant());

    const result = await handler.execute(cmd);

    expect(prisma.zatcaSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: DEFAULT_ORG,
          invoiceId: 'inv-1',
          xmlHash: expect.any(String),
        }),
      }),
    );
    expect(prisma.zatcaSubmission.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: ZatcaSubmissionStatus.SUBMITTED }) }),
    );
    expect(result.id).toBe('sub-1');
  });

  it('returns existing ACCEPTED submission without re-submitting', async () => {
    const prisma = buildPrisma();
    prisma.zatcaSubmission.findFirst = jest.fn().mockResolvedValue(mockSubmission);
    const handler = new ZatcaSubmitHandler(prisma as never, buildConfig() as never, buildTenant());

    const result = await handler.execute(cmd);

    expect(prisma.zatcaSubmission.create).not.toHaveBeenCalled();
    expect(result.status).toBe(ZatcaSubmissionStatus.ACCEPTED);
  });

  it('throws NotFoundException when invoice not found', async () => {
    const prisma = buildPrisma();
    prisma.invoice.findFirst = jest.fn().mockResolvedValue(null);
    await expect(new ZatcaSubmitHandler(prisma as never, buildConfig() as never, buildTenant()).execute(cmd))
      .rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when invoice is not PAID', async () => {
    const prisma = buildPrisma();
    prisma.invoice.findFirst = jest.fn().mockResolvedValue({ ...mockInvoice, status: 'ISSUED' });
    await expect(new ZatcaSubmitHandler(prisma as never, buildConfig() as never, buildTenant()).execute(cmd))
      .rejects.toThrow(BadRequestException);
  });

  it('re-submits REJECTED submission', async () => {
    const prisma = buildPrisma();
    prisma.zatcaSubmission.findFirst = jest.fn().mockResolvedValue({
      ...mockSubmission, status: ZatcaSubmissionStatus.REJECTED,
    });
    const handler = new ZatcaSubmitHandler(prisma as never, buildConfig() as never, buildTenant());

    await handler.execute(cmd);

    expect(prisma.zatcaSubmission.update).toHaveBeenCalledTimes(2);
  });
});
