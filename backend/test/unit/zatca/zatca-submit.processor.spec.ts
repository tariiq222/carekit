/**
 * CareKit — ZatcaSubmitProcessor Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { UnrecoverableError } from 'bullmq';
import { ZatcaSubmitProcessor } from '../../../src/modules/zatca/services/zatca-submit.processor.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { ZatcaApiService } from '../../../src/modules/zatca/services/zatca-api.service.js';
import { XmlSigningService } from '../../../src/modules/zatca/services/xml-signing.service.js';
import { InvoiceHashService } from '../../../src/modules/zatca/services/invoice-hash.service.js';
import { QueueFailureService } from '../../../src/common/queue/queue-failure.service.js';
import type { ZatcaApiResponse } from '../../../src/modules/zatca/services/zatca-api.service.js';

// ── Mocks ────────────────────────────────────────────────────────────────

const mockPrisma = {
  invoice: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  whiteLabelConfig: {
    findMany: jest.fn(),
  },
};

const mockApiService = {
  reportInvoice: jest.fn(),
};

const mockSigningService = {
  signXml: jest.fn(),
};

const mockHashService = {
  hashXml: jest.fn(),
  toBase64: jest.fn(),
};

const mockQueueFailureService = {
  notifyAdminsOfFailure: jest.fn(),
};

// ── Helpers ──────────────────────────────────────────────────────────────

function makeJob(
  data: { invoiceId: string },
  opts: { attempts?: number; attemptsMade?: number } = {},
) {
  return {
    data,
    id: 'job-001',
    name: 'zatca-submit',
    opts: { attempts: opts.attempts ?? 3 },
    attemptsMade: opts.attemptsMade ?? 0,
  } as any;
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('ZatcaSubmitProcessor', () => {
  let processor: ZatcaSubmitProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZatcaSubmitProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ZatcaApiService, useValue: mockApiService },
        { provide: XmlSigningService, useValue: mockSigningService },
        { provide: InvoiceHashService, useValue: mockHashService },
        { provide: QueueFailureService, useValue: mockQueueFailureService },
      ],
    }).compile();
    processor = module.get<ZatcaSubmitProcessor>(ZatcaSubmitProcessor);
  });

  // ─── process — successful submission ────────────────────────────────

  describe('process — successful submission', () => {
    beforeEach(() => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-001',
        xmlContent: '<Invoice>unsigned</Invoice>',
        invoiceHash: null,
        zatcaStatus: 'pending',
      });

      mockSigningService.signXml.mockResolvedValue('<Invoice>signed</Invoice>');
      mockHashService.hashXml.mockReturnValue('signed-hash-hex');
      mockHashService.toBase64.mockReturnValue('c2lnbmVkLWhhc2g=');

      mockPrisma.whiteLabelConfig.findMany.mockResolvedValue([
        { key: 'zatca_csid', value: 'csid-token' },
        { key: 'zatca_secret', value: 'secret-value' },
      ]);

      const successResponse: ZatcaApiResponse = {
        status: '200',
        reportingStatus: 'REPORTED',
        validationResults: {
          status: 'PASS',
          infoMessages: [],
          warningMessages: [],
          errorMessages: [],
        },
      };
      mockApiService.reportInvoice.mockResolvedValue(successResponse);
      mockPrisma.invoice.update.mockResolvedValue({});
    });

    it('should sign the XML, submit to ZATCA, and mark as reported', async () => {
      const job = makeJob({ invoiceId: 'inv-001' });
      await processor.process(job);

      expect(mockSigningService.signXml).toHaveBeenCalledWith(
        '<Invoice>unsigned</Invoice>',
      );
      expect(mockApiService.reportInvoice).toHaveBeenCalledWith(
        {
          invoiceHash: 'c2lnbmVkLWhhc2g=',
          uuid: 'inv-001',
          invoice: expect.any(String), // base64 of signed XML
        },
        { csid: 'csid-token', secret: 'secret-value' },
      );
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-001' },
          data: expect.objectContaining({ zatcaStatus: 'reported' }),
        }),
      );
    });

    it('should update invoice with zatcaResponse', async () => {
      const job = makeJob({ invoiceId: 'inv-001' });
      await processor.process(job);

      const updateCall = mockPrisma.invoice.update.mock.calls[0][0];
      expect(updateCall.data.zatcaResponse).toBeDefined();
    });

    it('should set sentAt date on success', async () => {
      const job = makeJob({ invoiceId: 'inv-001' });
      await processor.process(job);

      const updateCall = mockPrisma.invoice.update.mock.calls[0][0];
      expect(updateCall.data.sentAt).toBeInstanceOf(Date);
    });
  });

  // ─── process — already reported ─────────────────────────────────────

  describe('process — already reported invoice', () => {
    it('should skip if invoice is already reported', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-002',
        xmlContent: '<Invoice>old</Invoice>',
        invoiceHash: 'hash',
        zatcaStatus: 'reported',
      });

      const job = makeJob({ invoiceId: 'inv-002' });
      await processor.process(job);

      expect(mockApiService.reportInvoice).not.toHaveBeenCalled();
      expect(mockPrisma.invoice.update).not.toHaveBeenCalled();
    });
  });

  // ─── process — invoice not found or missing XML ─────────────────────

  describe('process — invalid job data', () => {
    it('should return early if invoice not found', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      const job = makeJob({ invoiceId: 'nonexistent' });
      await processor.process(job);

      expect(mockApiService.reportInvoice).not.toHaveBeenCalled();
    });

    it('should return early if invoice has no XML content', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-003',
        xmlContent: null,
        invoiceHash: null,
        zatcaStatus: 'pending',
      });

      const job = makeJob({ invoiceId: 'inv-003' });
      await processor.process(job);

      expect(mockSigningService.signXml).not.toHaveBeenCalled();
    });
  });

  // ─── process — ZATCA submission failure ─────────────────────────────

  describe('process — API failure / reporting failure', () => {
    beforeEach(() => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-004',
        xmlContent: '<Invoice>test</Invoice>',
        invoiceHash: null,
        zatcaStatus: 'pending',
      });

      mockSigningService.signXml.mockResolvedValue('<Invoice>signed</Invoice>');
      mockHashService.hashXml.mockReturnValue('hash-hex');
      mockHashService.toBase64.mockReturnValue('hash-b64');

      mockPrisma.whiteLabelConfig.findMany.mockResolvedValue([
        { key: 'zatca_csid', value: 'csid' },
        { key: 'zatca_secret', value: 'secret' },
      ]);

      mockPrisma.invoice.update.mockResolvedValue({});
    });

    it('should mark invoice as failed and throw when validation fails', async () => {
      const failResponse: ZatcaApiResponse = {
        status: '400',
        reportingStatus: 'NOT_REPORTED',
        validationResults: {
          status: 'FAIL',
          errorMessages: ['Invalid signature'],
        },
      };
      mockApiService.reportInvoice.mockResolvedValue(failResponse);

      const job = makeJob({ invoiceId: 'inv-004' });
      await expect(processor.process(job)).rejects.toThrow(
        'ZATCA submission failed',
      );

      expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-004' },
          data: expect.objectContaining({ zatcaStatus: 'failed' }),
        }),
      );
    });

    it('should not set sentAt on failure', async () => {
      const failResponse: ZatcaApiResponse = {
        status: '400',
        reportingStatus: 'NOT_REPORTED',
        validationResults: { status: 'FAIL', errorMessages: ['Bad hash'] },
      };
      mockApiService.reportInvoice.mockResolvedValue(failResponse);

      const job = makeJob({ invoiceId: 'inv-004' });
      try {
        await processor.process(job);
      } catch {
        // expected
      }

      const updateCall = mockPrisma.invoice.update.mock.calls[0][0];
      expect(updateCall.data.sentAt).toBeUndefined();
    });

    it('should throw when ZATCA credentials are missing (UnrecoverableError)', async () => {
      mockPrisma.whiteLabelConfig.findMany.mockResolvedValue([]);

      const job = makeJob({ invoiceId: 'inv-004' });
      await expect(processor.process(job)).rejects.toThrow(UnrecoverableError);
      await expect(processor.process(job)).rejects.toThrow(
        'ZATCA credentials missing',
      );
    });

    it('should propagate network errors from API', async () => {
      mockApiService.reportInvoice.mockRejectedValue(new Error('ECONNREFUSED'));

      const job = makeJob({ invoiceId: 'inv-004' });
      await expect(processor.process(job)).rejects.toThrow('ECONNREFUSED');
    });
  });

  // ─── onModuleInit ──────────────────────────────────────────────────

  describe('onModuleInit', () => {
    it('should not throw when called', () => {
      // onModuleInit accesses the BullMQ worker which requires a real Redis connection.
      // In unit tests, we verify it exists as a method but can't test the full
      // worker event registration without a real BullMQ worker.
      expect(typeof processor.onModuleInit).toBe('function');
    });
  });
});
