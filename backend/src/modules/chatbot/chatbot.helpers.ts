/**
 * Pure helper functions for the chatbot service — extracted to respect the 350-line limit.
 */

const ARABIC_REGEX = /[\u0600-\u06FF]/;

const INTENT_MAP: Record<string, string> = {
  create_booking: 'book',
  reschedule_booking: 'modify',
  request_cancellation: 'cancel',
  handoff_to_human: 'handoff',
  get_my_upcoming_bookings: 'query',
  list_services: 'query',
  list_practitioners: 'query',
  get_available_slots: 'query',
  search_knowledge_base: 'query',
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

export function classifyIntent(toolName?: string): string | undefined {
  if (!toolName) return 'query';
  return INTENT_MAP[toolName] ?? 'query';
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
