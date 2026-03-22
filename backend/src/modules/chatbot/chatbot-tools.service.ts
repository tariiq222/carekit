import { Injectable, Logger } from '@nestjs/common';
import { BookingsService } from '../bookings/bookings.service.js';
import { ServicesService } from '../services/services.service.js';
import { PractitionersService } from '../practitioners/practitioners.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { ChatbotRagService } from './chatbot-rag.service.js';
import { ChatbotConfigService } from './chatbot-config.service.js';
import type { ToolExecutionContext, ToolResult } from './interfaces/chatbot-tool.interface.js';

@Injectable()
export class ChatbotToolsService {
  private readonly logger = new Logger(ChatbotToolsService.name);

  constructor(
    private readonly bookingsService: BookingsService,
    private readonly servicesService: ServicesService,
    private readonly practitionersService: PractitionersService,
    private readonly ragService: ChatbotRagService,
    private readonly configService: ChatbotConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Execute a tool call by name. patientId is ALWAYS from JWT context.
   */
  async execute(
    toolName: string,
    args: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ): Promise<ToolResult> {
    try {
      switch (toolName) {
        case 'list_services':
          return await this.listServices(args);
        case 'list_practitioners':
          return await this.listPractitioners(args);
        case 'get_available_slots':
          return await this.getAvailableSlots(args);
        case 'create_booking':
          return await this.createBooking(args, ctx);
        case 'get_my_upcoming_bookings':
          return await this.getMyBookings(ctx);
        case 'reschedule_booking':
          return await this.rescheduleBooking(args, ctx);
        case 'request_cancellation':
          return await this.requestCancellation(args, ctx);
        case 'search_knowledge_base':
          return await this.searchKnowledgeBase(args);
        case 'handoff_to_human':
          return await this.handoffToHuman(args, ctx);
        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Tool ${toolName} failed: ${message}`);
      return { success: false, error: message };
    }
  }

  private async listServices(args: Record<string, unknown>): Promise<ToolResult> {
    const result = await this.servicesService.findAll({
      search: args.search as string | undefined,
      perPage: 10,
    });
    return { success: true, data: result.items };
  }

  private async listPractitioners(args: Record<string, unknown>): Promise<ToolResult> {
    const result = await this.practitionersService.findAll({
      search: args.search as string | undefined,
      specialtyId: args.specialtyId as string | undefined,
      perPage: 10,
    });
    return { success: true, data: result.items };
  }

  private async getAvailableSlots(args: Record<string, unknown>): Promise<ToolResult> {
    const practitionerId = args.practitionerId as string;
    const date = args.date as string;
    const serviceId = args.serviceId as string | undefined;

    let duration: number | undefined;
    if (serviceId && practitionerId) {
      const ps = await this.prisma.practitionerService.findUnique({
        where: { practitionerId_serviceId: { practitionerId, serviceId } },
      });
      if (ps?.customDuration) {
        duration = ps.customDuration;
      } else {
        const service = await this.servicesService.findOne(serviceId);
        duration = service.duration;
      }
    } else if (serviceId) {
      const service = await this.servicesService.findOne(serviceId);
      duration = service.duration;
    }

    const slots = await this.practitionersService.getAvailableSlots(
      practitionerId,
      date,
      duration,
    );
    return { success: true, data: slots };
  }

  private async createBooking(
    args: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ): Promise<ToolResult> {
    // Double-check config allows booking
    const config = await this.configService.getConfigMap();
    if (!config.can_book) {
      return { success: false, error: 'Booking via chatbot is disabled by clinic settings.' };
    }

    const booking = await this.bookingsService.create(ctx.userId, {
      practitionerId: args.practitionerId as string,
      serviceId: args.serviceId as string,
      type: args.type as 'clinic_visit' | 'phone_consultation' | 'video_consultation',
      date: args.date as string,
      startTime: args.startTime as string,
      notes: (args.notes as string) ?? 'Booked via AI chatbot',
    });

    return { success: true, data: booking };
  }

  private async getMyBookings(ctx: ToolExecutionContext): Promise<ToolResult> {
    const result = await this.bookingsService.findMyBookings(ctx.userId);
    const upcoming = result.items.filter(
      (b: { status: string }) => b.status === 'pending' || b.status === 'confirmed',
    );
    return { success: true, data: upcoming };
  }

  private async rescheduleBooking(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
    const bookingId = args.bookingId as string;

    // Verify the booking belongs to this patient
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
    });
    if (!booking) {
      return { success: false, error: 'Booking not found' };
    }
    if (booking.patientId !== ctx.userId) {
      return { success: false, error: 'You can only reschedule your own bookings' };
    }

    const dto: { date?: string; startTime?: string } = {};
    if (args.newDate) dto.date = args.newDate as string;
    if (args.newStartTime) dto.startTime = args.newStartTime as string;

    const updated = await this.bookingsService.reschedule(bookingId, dto);
    return { success: true, data: updated };
  }

  private async requestCancellation(
    args: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ): Promise<ToolResult> {
    const bookingId = args.bookingId as string;
    const reason = (args.reason as string) ?? 'Requested via AI chatbot';

    const booking = await this.bookingsService.requestCancellation(
      bookingId,
      ctx.userId,
      reason,
    );
    return { success: true, data: booking };
  }

  private async searchKnowledgeBase(args: Record<string, unknown>): Promise<ToolResult> {
    const query = args.query as string;
    const results = await this.ragService.searchSimilar(query, 5);
    return { success: true, data: results };
  }

  private async handoffToHuman(
    args: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ): Promise<ToolResult> {
    const config = await this.configService.getConfigMap();

    // Mark session as handed off
    await this.prisma.chatSession.update({
      where: { id: ctx.sessionId },
      data: {
        handedOff: true,
        handoffType: config.handoff_type === 'live_chat' ? 'live_chat' : 'contact_number',
      },
    });

    if (config.handoff_type === 'contact_number') {
      return {
        success: true,
        data: {
          type: 'contact_number',
          number: config.handoff_contact_number,
          message_ar: config.handoff_message_ar,
          message_en: config.handoff_message_en,
        },
      };
    }

    return {
      success: true,
      data: {
        type: 'live_chat',
        message_ar: config.handoff_message_ar,
        message_en: config.handoff_message_en,
        reason: args.reason,
      },
    };
  }
}
