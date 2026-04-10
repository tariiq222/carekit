import type { ChatbotConfigEntry } from '../interfaces/chatbot-config.interface.js';

export const CHATBOT_CONFIG_DEFAULTS: ChatbotConfigEntry[] = [
  // ── Personality ──
  { key: 'bot_name', value: 'CareKit Assistant', category: 'personality' },
  { key: 'bot_avatar_url', value: null, category: 'personality' },
  { key: 'tone', value: 'professional', category: 'personality' },
  { key: 'supported_languages', value: ['ar', 'en'], category: 'personality' },
  {
    key: 'welcome_message_ar',
    value: 'مرحباً! أنا مساعدك الذكي. كيف أقدر أساعدك اليوم؟',
    category: 'personality',
  },
  {
    key: 'welcome_message_en',
    value: "Hello! I'm your smart assistant. How can I help you today?",
    category: 'personality',
  },
  { key: 'custom_instructions', value: '', category: 'personality' },

  // ── Rules ──
  { key: 'can_book', value: true, category: 'rules' },
  { key: 'can_reschedule', value: true, category: 'rules' },
  { key: 'can_request_cancel', value: true, category: 'rules' },
  { key: 'can_view_prices', value: true, category: 'rules' },
  { key: 'max_messages_per_session', value: 50, category: 'rules' },
  { key: 'max_tool_calls_per_message', value: 5, category: 'rules' },
  {
    key: 'restricted_topics',
    value: ['medical_advice', 'diagnosis', 'prescription'],
    category: 'rules',
  },
  {
    key: 'restricted_topics_response_ar',
    value:
      'عذراً، لا أستطيع تقديم استشارات طبية. يرجى التواصل مع الطبيب مباشرة.',
    category: 'rules',
  },
  {
    key: 'restricted_topics_response_en',
    value:
      'Sorry, I cannot provide medical advice. Please consult with a doctor directly.',
    category: 'rules',
  },
  { key: 'require_booking_confirmation', value: true, category: 'rules' },

  // ── Quick Replies ──
  {
    key: 'quick_replies',
    value: [
      { label_ar: 'حجز موعد', label_en: 'Book Appointment', action: 'book' },
      {
        label_ar: 'مواعيدي',
        label_en: 'My Appointments',
        action: 'my_appointments',
      },
      { label_ar: 'الخدمات', label_en: 'Services', action: 'services' },
      { label_ar: 'مساعدة', label_en: 'Help', action: 'help' },
    ],
    category: 'quick_replies',
  },

  // ── Handoff ──
  { key: 'handoff_type', value: 'contact_number', category: 'handoff' },
  { key: 'handoff_contact_number', value: '', category: 'handoff' },
  { key: 'handoff_after_failures', value: 3, category: 'handoff' },
  {
    key: 'handoff_message_ar',
    value: 'سأحولك الآن للتواصل مع فريقنا.',
    category: 'handoff',
  },
  {
    key: 'handoff_message_en',
    value: 'I will now connect you with our team.',
    category: 'handoff',
  },

  // ── Sync ──
  { key: 'auto_sync_enabled', value: true, category: 'sync' },
  { key: 'auto_sync_interval_hours', value: 24, category: 'sync' },
  { key: 'auto_sync_services', value: true, category: 'sync' },
  { key: 'auto_sync_practitioners', value: true, category: 'sync' },
  { key: 'last_sync_at', value: null, category: 'sync' },

  // ── AI Model ──
  { key: 'ai_model', value: 'openai/gpt-4o', category: 'ai_model' },
  { key: 'ai_temperature', value: 0.3, category: 'ai_model' },
  { key: 'ai_max_tokens', value: 1000, category: 'ai_model' },
  { key: 'context_window_size', value: 20, category: 'ai_model' },
];
