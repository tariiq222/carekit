import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EmailTemplatesService } from '../email-templates.service.js';
import { PrismaService } from '../../../database/prisma.service.js';

const mockPrisma = {
  emailTemplate: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const activeTemplate = {
  id: 'tpl-1',
  slug: 'booking_confirm',
  subjectEn: 'Booking {{bookingId}} confirmed',
  bodyEn: 'Dear {{name}}, your booking is confirmed.',
  subjectAr: 'تأكيد الحجز {{bookingId}}',
  bodyAr: 'عزيزي {{name}}',
  isActive: true,
};

describe('EmailTemplatesService', () => {
  let service: EmailTemplatesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailTemplatesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<EmailTemplatesService>(EmailTemplatesService);
  });

  // ─────────────────────────────────────────────────────────────
  //  findBySlug
  // ─────────────────────────────────────────────────────────────

  describe('findBySlug', () => {
    it('should return template when found', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(activeTemplate);

      const result = await service.findBySlug('booking_confirm');

      expect(result).toEqual(activeTemplate);
    });

    it('should throw NotFoundException when template not found', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);

      await expect(service.findBySlug('unknown_slug')).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  //  update
  // ─────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update template fields', async () => {
      const updated = { ...activeTemplate, subjectEn: 'Updated subject' };
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(activeTemplate);
      mockPrisma.emailTemplate.update.mockResolvedValue(updated);

      const result = await service.update('tpl-1', { subjectEn: 'Updated subject' });

      expect(mockPrisma.emailTemplate.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'tpl-1' } }),
      );
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException when template not found', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);

      await expect(service.update('missing-id', { subjectEn: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  //  renderTemplate
  // ─────────────────────────────────────────────────────────────

  describe('renderTemplate', () => {
    it('should return null when template not found', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);

      const result = await service.renderTemplate('missing', {}, 'en');

      expect(result).toBeNull();
    });

    it('should return null when template is inactive', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue({
        ...activeTemplate,
        isActive: false,
      });

      const result = await service.renderTemplate('booking_confirm', {}, 'en');

      expect(result).toBeNull();
    });

    it('should replace {{var}} placeholders with context values (lang=en)', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(activeTemplate);

      const result = await service.renderTemplate(
        'booking_confirm',
        { bookingId: 'B-123', name: 'Ahmad' },
        'en',
      );

      expect(result).toEqual({
        subject: 'Booking B-123 confirmed',
        body: 'Dear Ahmad, your booking is confirmed.',
      });
    });

    it('should use Arabic subject/body when lang=ar', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(activeTemplate);

      const result = await service.renderTemplate(
        'booking_confirm',
        { bookingId: 'B-456', name: 'محمد' },
        'ar',
      );

      expect(result).toEqual({
        subject: 'تأكيد الحجز B-456',
        body: 'عزيزي محمد',
      });
    });

    it('should keep {{var}} unchanged when value is undefined', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(activeTemplate);

      const result = await service.renderTemplate(
        'booking_confirm',
        { bookingId: 'B-789' },
        'en',
      );

      expect(result?.body).toBe('Dear {{name}}, your booking is confirmed.');
    });

    it('should keep {{var}} unchanged when value is an object', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(activeTemplate);

      const result = await service.renderTemplate(
        'booking_confirm',
        { bookingId: 'B-000', name: { first: 'Ahmad' } },
        'en',
      );

      expect(result?.body).toBe('Dear {{name}}, your booking is confirmed.');
    });
  });

  // ─────────────────────────────────────────────────────────────
  //  preview
  // ─────────────────────────────────────────────────────────────

  describe('preview', () => {
    it('should render template with provided context', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(activeTemplate);

      const result = await service.preview(
        'booking_confirm',
        { bookingId: 'B-999', name: 'Sara' },
        'en',
      );

      expect(result).toEqual({
        subject: 'Booking B-999 confirmed',
        body: 'Dear Sara, your booking is confirmed.',
      });
    });
  });
});
