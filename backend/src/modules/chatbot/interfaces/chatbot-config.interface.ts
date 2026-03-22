export interface ChatbotConfigMap {
  // Personality
  bot_name: string;
  bot_avatar_url: string | null;
  tone: 'formal' | 'friendly' | 'professional' | 'medical';
  supported_languages: string[];
  welcome_message_ar: string;
  welcome_message_en: string;
  custom_instructions: string;

  // Rules
  can_book: boolean;
  can_reschedule: boolean;
  can_request_cancel: boolean;
  can_view_prices: boolean;
  max_messages_per_session: number;
  max_tool_calls_per_message: number;
  restricted_topics: string[];
  restricted_topics_response_ar: string;
  restricted_topics_response_en: string;
  require_booking_confirmation: boolean;

  // Quick Replies
  quick_replies: QuickReply[];

  // Handoff
  handoff_type: 'live_chat' | 'contact_number';
  handoff_contact_number: string;
  handoff_after_failures: number;
  handoff_message_ar: string;
  handoff_message_en: string;

  // Sync
  auto_sync_enabled: boolean;
  auto_sync_interval_hours: number;
  auto_sync_services: boolean;
  auto_sync_practitioners: boolean;
  last_sync_at: string | null;

  // AI Model
  ai_model: string;
  ai_temperature: number;
  ai_max_tokens: number;
  context_window_size: number;
}

export interface QuickReply {
  label_ar: string;
  label_en: string;
  action: string;
}

export interface ChatbotConfigEntry {
  key: string;
  value: unknown;
  category: string;
}
