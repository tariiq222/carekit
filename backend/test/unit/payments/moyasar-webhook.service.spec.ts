import * as crypto from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MoyasarWebhookService } from '../../../src/modules/payments/moyasar-webhook.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { InvoiceCreatorService } from '../../../src/modules/invoices/invoice-creator.service.js';
import { BookingStatusService } from '../../../src/modules/bookings/booking-status.service.js';
import { GroupsPaymentService } from '../../../src/modules/groups/groups-payment.service.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaServiceMock: any = {
  payment: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
    create: jest.fn().mockResolvedValue({ id: 'pmt-1' }),
  },
  groupPayment: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  },
  processedWebhook: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  booking: { update: jest.fn() },
  groupEnrollment: { update: jest.fn().mockResolvedValue({}) },
  $transaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) => cb(prismaServiceMock)),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const configServiceMock: any = {
  get: jest.fn().mockReturnValue('test-secret'),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const invoicesServiceMock: any = { createInvoice: jest.fn() };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bookingStatusServiceMock: any = { confirm: jest.fn(), cancel: jest.fn() };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const groupsPaymentServiceMock: any = { confirmEnrollmentAfterPayment: jest.fn() };

describe('MoyasarWebhookService', () => {
  let service: MoyasarWebhookService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MoyasarWebhookService,
        { provide: PrismaService, useValue: prismaServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: InvoiceCreatorService, useValue: invoicesServiceMock },
        { provide: BookingStatusService, useValue: bookingStatusServiceMock },
        { provide: GroupsPaymentService, useValue: groupsPaymentServiceMock },
      ],
    }).compile();

    service = module.get<MoyasarWebhookService>(MoyasarWebhookService);
    jest.clearAllMocks();
  });

  describe('verifySignature', () => {
    it('should reject a non-hex signature without throwing a Buffer error', () => {
      jest.spyOn(configServiceMock, 'get').mockReturnValue('test-secret');
      expect(() => (service as any).verifySignature('not-hex-$$$$', Buffer.from('body'))).toThrow(UnauthorizedException);
    });

    it('should reject a valid-format signature with wrong value', () => {
      const secret = 'test-secret';
      const body = Buffer.from('{"id":"evt_1","status":"paid","amount":1000}');
      const correctSig = crypto.createHmac('sha256', secret).update(body).digest('hex');
      const tamperedSig = correctSig.slice(0, -1) + (correctSig.endsWith('a') ? 'b' : 'a');
      jest.spyOn(configServiceMock, 'get').mockReturnValue(secret);
      expect(() => (service as any).verifySignature(tamperedSig, body)).toThrow(UnauthorizedException);
    });

    it('should accept a valid signature', () => {
      const secret = 'test-secret';
      const body = Buffer.from('{"id":"evt_1","status":"paid","amount":1000}');
      const validSig = crypto.createHmac('sha256', secret).update(body).digest('hex');
      jest.spyOn(configServiceMock, 'get').mockReturnValue(secret);
      expect(() => (service as any).verifySignature(validSig, body)).not.toThrow();
    });

    it('should throw WEBHOOK_CONFIG_ERROR when secret is not configured', () => {
      jest.spyOn(configServiceMock, 'get').mockReturnValue('');
      expect(() => (service as any).verifySignature('abc123', Buffer.from('body'))).toThrow(UnauthorizedException);
    });
  });

  describe('processGroupPaymentSuccess', () => {
    it('marks groupPayment failed and does NOT confirm enrollment when amount mismatch', async () => {
      const groupPayment = { id: 'gp1', enrollmentId: 'e1', totalAmount: 1000, status: 'pending' };
      prismaServiceMock.groupPayment.findUnique.mockResolvedValue(groupPayment);
      prismaServiceMock.groupPayment.updateMany.mockResolvedValue({ count: 1 });
      prismaServiceMock.processedWebhook.findUnique.mockResolvedValue(null);
      prismaServiceMock.processedWebhook.create.mockResolvedValue({});

      await (service as any).processGroupPaymentSuccess('gp1', 'e1', 'evt_1', 500);

      expect(prismaServiceMock.groupPayment.updateMany).toHaveBeenCalledWith({
        where: { id: 'gp1', status: 'pending' },
        data: { status: 'failed' },
      });
      expect(groupsPaymentServiceMock.confirmEnrollmentAfterPayment).not.toHaveBeenCalled();
    });

    it('confirms enrollment AFTER transaction when amount matches', async () => {
      const groupPayment = { id: 'gp1', enrollmentId: 'e1', totalAmount: 1000, status: 'pending' };
      prismaServiceMock.groupPayment.findUnique.mockResolvedValue(groupPayment);
      prismaServiceMock.groupPayment.updateMany.mockResolvedValue({ count: 1 });
      prismaServiceMock.processedWebhook.findUnique.mockResolvedValue(null);
      prismaServiceMock.processedWebhook.create.mockResolvedValue({});

      await (service as any).processGroupPaymentSuccess('gp1', 'e1', 'evt_1', 1000);

      expect(groupsPaymentServiceMock.confirmEnrollmentAfterPayment).toHaveBeenCalledWith('e1');
    });

    it('is idempotent — duplicate webhook does not double-confirm', async () => {
      prismaServiceMock.processedWebhook.findUnique.mockResolvedValue({ eventId: 'evt_1', processedAt: new Date() });

      await (service as any).processGroupPaymentSuccess('gp1', 'e1', 'evt_1', 1000);

      expect(prismaServiceMock.groupPayment.updateMany).not.toHaveBeenCalled();
      expect(groupsPaymentServiceMock.confirmEnrollmentAfterPayment).not.toHaveBeenCalled();
    });
  });
});
