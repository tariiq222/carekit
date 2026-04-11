/**
 * Pure helper functions for the chatbot service — extracted to respect the 350-line limit.
 */
import { ChatIntent } from '@prisma/client';

const ARABIC_REGEX = /[\u0600-\u06FF]/;

const INTENT_MAP: Record<string, ChatIntent> = {
  create_booking: ChatIntent.book,
  reschedule_booking: ChatIntent.modify,
  request_cancellation: ChatIntent.cancel,
  handoff_to_human: ChatIntent.handoff,
  get_my_upcoming_bookings: ChatIntent.query,
  list_services: ChatIntent.query,
  list_practitioners: ChatIntent.query,
  get_available_slots: ChatIntent.query,
  search_knowledge_base: ChatIntent.query,
};

const ACTION_CARD_MAP: Record<string, string> = {
  create_booking: 'booking_created',
  get_my_upcoming_bookings: 'bookings_list',
  list_services: 'services_list',
  list_practitioners: 'practitioners_list',
  get_available_slots: 'slots_list',
  request_cancellation: 'cancellation_requested',
  handoff_to_human: 'handoff',
};

export function detectLanguage(text: string): string {
  return ARABIC_REGEX.test(text) ? 'ar' : 'en';
}

export function classifyIntent(toolName?: string): ChatIntent {
  if (!toolName) return ChatIntent.query;
  return INTENT_MAP[toolName] ?? ChatIntent.query;
}

export function buildActionCard(
  toolName: string,
  result: { success: boolean; data?: unknown },
): { type: string; payload: unknown } | undefined {
  if (!result.success) return undefined;

  const type = ACTION_CARD_MAP[toolName];
  if (!type) return undefined;

  return { type, payload: result.data };
}
