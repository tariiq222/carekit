import { ZatcaSandboxService } from '../../../src/modules/zatca/services/zatca-sandbox.service.js';
import { NotFoundException, BadRequestException } from '@nestjs/common';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  invoice: {
    findUnique: jest.fn(),
    update: jest.fn(),
    groupBy: jest.fn(),
  },
  whiteLabelConfig: {
    findMany: jest.fn(),
  },
};

const mockZatcaService = {};

const mockZatcaApiService = {
  reportInvoice: jest.fn(),
};

const mockHashService = {};

// ── Factory ──────────────────────────────────────────────────────────────────

function makeService(): ZatcaSandboxService {
  return new ZatcaSandboxService(
    mockPrisma as never,
    mockZatcaService as never,
    mockZatcaApiService as never,
    mockHashService as never,
  );
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const INVOICE_ID = 'invoice-uuid-123';

const mockInvoice = {
  id: INVOICE_ID,
  invoiceNumber: 'INV-001',
  xmlContent: '<Invoice>...</Invoice>',
  invoiceHash: 'abc123hash==',
  zatcaStatus: 'pending',
};

const mockCredentials = [
  { key: 'zatca_csid', value: 'test-csid-token' },
  { key: 'zatca_secret', value: 'test-secret' },
];

const successfulApiResponse = {
  status: 'PASS',
  reportingStatus: 'REPORTED',
  validationResults: { status: 'PASS', errorMessages: [], warningMessages: [] },
};

const failedApiResponse = {
  status: 'ERROR',
  reportingStatus: 'NOT_REPORTED',
  validationResults: {
    status: 'ERROR',
    errorMessages: [{ message: 'Invalid invoice hash' }],
  },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ZatcaSandboxService', () => {
  let service: ZatcaSandboxService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = makeService();

    // Default: invoice exists and has credentials
    mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
    mockPrisma.whiteLabelConfig.findMany.mockResolvedValue(mockCredentials);
    mockPrisma.invoice.update.mockResolvedValue({ ...mockInvoice, zatcaStatus: 'reported' });
  });

  // ── reportInvoiceToSandbox ────────────────────────────────────────────────

  describe('reportInvoiceToSandbox', () => {
    it('reports invoice successfully when API returns REPORTED', async () => {
      mockZatcaApiService.reportInvoice.mockResolvedValue(successfulApiResponse);

      const result = await service.reportInvoiceToSandbox(INVOICE_ID);

      expect(result.success).toBe(true);
      expect(result.reportingStatus).toBe('REPORTED');
      expect(result.message).toContain('successfully');
    });

    it('calls reportInvoice with correct base64 XML and credentials', async () => {
      mockZatcaApiService.reportInvoice.mockResolvedValue(successfulApiResponse);

      await service.reportInvoiceToSandbox(INVOICE_ID);

      const expectedBase64 = Buffer.from(mockInvoice.xmlContent).toString('base64');
      expect(mockZatcaApiService.reportInvoice).toHaveBeenCalledWith(
        {
          invoiceHash: mockInvoice.invoiceHash,
          uuid: INVOICE_ID,
          invoice: expectedBase64,
        },
        { csid: 'test-csid-token', secret: 'test-secret' },
      );
    });

    it('updates invoice status to reported on success', async () => {
      mockZatcaApiService.reportInvoice.mockResolvedValue(successfulApiResponse);

      await service.reportInvoiceToSandbox(INVOICE_ID);

      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: INVOICE_ID },
        data: expect.objectContaining({ zatcaStatus: 'reported' }),
      });
    });

    it('updates invoice status to failed when API returns error', async () => {
      mockZatcaApiService.reportInvoice.mockResolvedValue(failedApiResponse);

      const result = await service.reportInvoiceToSandbox(INVOICE_ID);

      expect(result.success).toBe(false);
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: INVOICE_ID },
        data: expect.objectContaining({ zatcaStatus: 'failed' }),
      });
    });

    it('returns failure message when API returns NOT_REPORTED', async () => {
      mockZatcaApiService.reportInvoice.mockResolvedValue(failedApiResponse);

      const result = await service.reportInvoiceToSandbox(INVOICE_ID);

      expect(result.success).toBe(false);
      expect(result.message).toContain('failed');
    });

    it('throws NotFoundException when invoice does not exist', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      await expect(service.reportInvoiceToSandbox('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when invoice has no XML content', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        xmlContent: null,
      });

      await expect(service.reportInvoiceToSandbox(INVOICE_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when invoice has no hash', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        invoiceHash: null,
      });

      await expect(service.reportInvoiceToSandbox(INVOICE_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when CSID credentials are not configured', async () => {
      mockPrisma.whiteLabelConfig.findMany.mockResolvedValue([]);

      await expect(service.reportInvoiceToSandbox(INVOICE_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when only CSID is configured (secret missing)', async () => {
      mockPrisma.whiteLabelConfig.findMany.mockResolvedValue([
        { key: 'zatca_csid', value: 'test-csid' },
      ]);

      await expect(service.reportInvoiceToSandbox(INVOICE_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('considers validation PASS as success even without reportingStatus', async () => {
      mockZatcaApiService.reportInvoice.mockResolvedValue({
        status: 'PASS',
        validationResults: { status: 'PASS' },
      });

      const result = await service.reportInvoiceToSandbox(INVOICE_ID);

      expect(result.success).toBe(true);
    });
  });

  // ── getSandboxStats ───────────────────────────────────────────────────────

  describe('getSandboxStats', () => {
    it('returns correct counts for all statuses', async () => {
      mockPrisma.invoice.groupBy.mockResolvedValue([
        { zatcaStatus: 'pending', _count: { _all: 5 } },
        { zatcaStatus: 'reported', _count: { _all: 12 } },
        { zatcaStatus: 'failed', _count: { _all: 2 } },
        { zatcaStatus: 'not_applicable', _count: { _all: 30 } },
      ]);

      const stats = await service.getSandboxStats();

      expect(stats).toEqual({
        pending: 5,
        reported: 12,
        failed: 2,
        notApplicable: 30,
      });
    });

    it('returns zeros for missing statuses', async () => {
      mockPrisma.invoice.groupBy.mockResolvedValue([
        { zatcaStatus: 'reported', _count: { _all: 7 } },
      ]);

      const stats = await service.getSandboxStats();

      expect(stats.pending).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.notApplicable).toBe(0);
      expect(stats.reported).toBe(7);
    });

    it('returns all zeros when no invoices exist', async () => {
      mockPrisma.invoice.groupBy.mockResolvedValue([]);

      const stats = await service.getSandboxStats();

      expect(stats).toEqual({ pending: 0, reported: 0, failed: 0, notApplicable: 0 });
    });
  });
});
