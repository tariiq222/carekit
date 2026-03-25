/**
 * L1: Abstraction interfaces for chatbot domain dependencies.
 * ChatbotToolsService depends on these interfaces, NOT on concrete service classes.
 * This breaks the tight coupling and makes the chatbot module independently testable.
 */

export interface IChatbotBookingPort {
  create(userId: string, dto: Record<string, unknown>): Promise<unknown>;
  findMyBookings(userId: string): Promise<{ items: Array<{ status: string; [key: string]: unknown }> }>;
  patientReschedule(bookingId: string, patientId: string, dto: Record<string, unknown>): Promise<unknown>;
  requestCancellation(bookingId: string, patientId: string, reason?: string): Promise<unknown>;
}

export interface IChatbotServicePort {
  findAll(query: { search?: string; perPage?: number }): Promise<{ items: unknown[] }>;
  findOne(id: string): Promise<{ duration: number; [key: string]: unknown }>;
}

export interface IChatbotPractitionerPort {
  findAll(query: { search?: string; specialty?: string; perPage?: number }): Promise<{ items: unknown[] }>;
  getAvailableSlots(practitionerId: string, date: string, duration?: number): Promise<unknown>;
}

export const CHATBOT_BOOKING_PORT = Symbol('CHATBOT_BOOKING_PORT');
export const CHATBOT_SERVICE_PORT = Symbol('CHATBOT_SERVICE_PORT');
export const CHATBOT_PRACTITIONER_PORT = Symbol('CHATBOT_PRACTITIONER_PORT');
