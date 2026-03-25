/** CareKit — ChatbotToolsService Unit Tests */

import { Test, TestingModule } from '@nestjs/testing';
import { ChatbotToolsService } from '../chatbot-tools.service.js';
import { BookingsService } from '../../bookings/bookings.service.js';
import { ServicesService } from '../../services/services.service.js';
import { PractitionersService } from '../../practitioners/practitioners.service.js';
import { ChatbotRagService } from '../chatbot-rag.service.js';
import { ChatbotConfigService } from '../chatbot-config.service.js';
import { PrismaService } from '../../../database/prisma.service.js';

const mockBookingsService: any = {
  create: jest.fn(),
  findMyBookings: jest.fn(),
  reschedule: jest.fn(),
  requestCancellation: jest.fn(),
};

const mockServicesService: any = {
  findAll: jest.fn(),
  findOne: jest.fn(),
};

const mockPractitionersService: any = {
  findAll: jest.fn(),
  getAvailableSlots: jest.fn(),
};

const mockRagService: any = {
  searchSimilar: jest.fn(),
};

const mockConfigService: any = {
  getConfigMap: jest.fn(),
};

const mockPrisma: any = {
  chatSession: { update: jest.fn() },
  practitionerService: { findUnique: jest.fn() },
  booking: { findFirst: jest.fn() },
};

const ctx = { userId: 'user-1', sessionId: 'session-1' };

describe('ChatbotToolsService', () => {
  let service: ChatbotToolsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatbotToolsService,
        { provide: BookingsService, useValue: mockBookingsService },
        { provide: ServicesService, useValue: mockServicesService },
        { provide: PractitionersService, useValue: mockPractitionersService },
        { provide: ChatbotRagService, useValue: mockRagService },
        { provide: ChatbotConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ChatbotToolsService>(ChatbotToolsService);
  });

  describe('list_services', () => {
    it('calls ServicesService.findAll and returns data', async () => {
      const mockItems = [{ id: 's-1', nameEn: 'Checkup' }];
      mockServicesService.findAll.mockResolvedValue({ items: mockItems });

      const result = await service.execute('list_services', { search: 'check' }, ctx);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockItems);
      expect(mockServicesService.findAll).toHaveBeenCalledWith({ search: 'check', perPage: 10 });
    });
  });

  describe('list_practitioners', () => {
    it('calls PractitionersService.findAll with params', async () => {
      mockPractitionersService.findAll.mockResolvedValue({ items: [] });

      const result = await service.execute('list_practitioners', { search: 'Ahmed' }, ctx);
      expect(result.success).toBe(true);
      expect(mockPractitionersService.findAll).toHaveBeenCalledWith({
        search: 'Ahmed',
        specialty: undefined,
        perPage: 10,
      });
    });
  });

  describe('get_available_slots', () => {
    it('fetches slots for practitioner and date', async () => {
      const slots = ['09:00', '10:00', '14:00'];
      mockPractitionersService.getAvailableSlots.mockResolvedValue(slots);

      const result = await service.execute(
        'get_available_slots',
        { practitionerId: 'p-1', date: '2026-04-01' },
        ctx,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(slots);
    });

    it('resolves service duration when serviceId provided', async () => {
      // practitionerService has no customDuration, so falls back to servicesService.findOne
      mockPrisma.practitionerService.findUnique.mockResolvedValue({ id: 'ps-1', customDuration: null });
      mockServicesService.findOne.mockResolvedValue({ duration: 45 });
      mockPractitionersService.getAvailableSlots.mockResolvedValue([]);

      await service.execute(
        'get_available_slots',
        { practitionerId: 'p-1', date: '2026-04-01', serviceId: 's-1' },
        ctx,
      );
      expect(mockServicesService.findOne).toHaveBeenCalledWith('s-1');
      expect(mockPractitionersService.getAvailableSlots).toHaveBeenCalledWith('p-1', '2026-04-01', 45);
    });
  });

  describe('create_booking', () => {
    it('creates booking using patientId from context (not AI)', async () => {
      mockConfigService.getConfigMap.mockResolvedValue({ can_book: true });
      const mockBooking = { id: 'b-1', status: 'pending' };
      mockBookingsService.create.mockResolvedValue(mockBooking);

      const result = await service.execute(
        'create_booking',
        {
          practitionerId: 'p-1',
          serviceId: 's-1',
          type: 'clinic_visit',
          date: '2026-04-01',
          startTime: '10:00',
        },
        ctx,
      );

      expect(result.success).toBe(true);
      expect(mockBookingsService.create).toHaveBeenCalledWith('user-1', expect.objectContaining({
        practitionerId: 'p-1',
        serviceId: 's-1',
      }));
    });

    it('rejects booking when can_book is false', async () => {
      mockConfigService.getConfigMap.mockResolvedValue({ can_book: false });

      const result = await service.execute(
        'create_booking',
        { practitionerId: 'p-1', serviceId: 's-1', type: 'clinic_visit', date: '2026-04-01', startTime: '10:00' },
        ctx,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled');
      expect(mockBookingsService.create).not.toHaveBeenCalled();
    });
  });

  describe('get_my_upcoming_bookings', () => {
    it('returns only pending/confirmed bookings', async () => {
      mockBookingsService.findMyBookings.mockResolvedValue({
        items: [
          { id: 'b-1', status: 'confirmed' },
          { id: 'b-2', status: 'completed' },
          { id: 'b-3', status: 'pending' },
        ],
      });

      const result = await service.execute('get_my_upcoming_bookings', {}, ctx);
      expect(result.success).toBe(true);
      expect((result.data as any[]).length).toBe(2);
    });
  });

  describe('request_cancellation', () => {
    it('passes patientId from context', async () => {
      mockBookingsService.requestCancellation.mockResolvedValue({ id: 'b-1' });

      const result = await service.execute(
        'request_cancellation',
        { bookingId: 'b-1', reason: 'Changed my mind' },
        ctx,
      );
      expect(result.success).toBe(true);
      expect(mockBookingsService.requestCancellation).toHaveBeenCalledWith('b-1', 'user-1', 'Changed my mind');
    });
  });

  describe('search_knowledge_base', () => {
    it('delegates to RAG service', async () => {
      mockRagService.searchSimilar.mockResolvedValue([
        { title: 'FAQ', content: 'Answer', similarity: 0.9 },
      ]);

      const result = await service.execute('search_knowledge_base', { query: 'working hours' }, ctx);
      expect(result.success).toBe(true);
      expect(mockRagService.searchSimilar).toHaveBeenCalledWith('working hours', 5);
    });
  });

  describe('handoff_to_human', () => {
    it('marks session as handed off with contact number', async () => {
      mockConfigService.getConfigMap.mockResolvedValue({
        handoff_type: 'contact_number',
        handoff_contact_number: '0501234567',
        handoff_message_ar: 'سيتم تحويلك',
        handoff_message_en: 'Transferring...',
      });
      mockPrisma.chatSession.update.mockResolvedValue({});

      const result = await service.execute('handoff_to_human', { reason: 'complex' }, ctx);
      expect(result.success).toBe(true);
      expect(mockPrisma.chatSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { handedOff: true, handoffType: 'contact_number' },
      });
      expect((result.data as any).number).toBe('0501234567');
    });
  });

  describe('unknown tool', () => {
    it('returns error for unknown tool name', async () => {
      const result = await service.execute('nonexistent_tool', {}, ctx);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });
  });

  describe('error handling', () => {
    it('catches service errors and returns them gracefully', async () => {
      mockServicesService.findAll.mockRejectedValue(new Error('DB connection lost'));

      const result = await service.execute('list_services', {}, ctx);
      expect(result.success).toBe(false);
      expect(result.error).toContain('DB connection lost');
    });
  });
});
