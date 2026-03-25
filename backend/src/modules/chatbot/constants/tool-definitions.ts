import type { OpenRouterTool } from '../interfaces/chatbot-tool.interface.js';
import type { ChatbotConfigMap } from '../interfaces/chatbot-config.interface.js';

const TOOL_LIST_SERVICES: OpenRouterTool = {
  type: 'function',
  function: {
    name: 'list_services',
    description: 'List available clinic services with prices and durations',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by category name' },
        search: { type: 'string', description: 'Search by service name' },
      },
    },
  },
};

const TOOL_LIST_PRACTITIONERS: OpenRouterTool = {
  type: 'function',
  function: {
    name: 'list_practitioners',
    description: 'List available practitioners/doctors with specialties and prices',
    parameters: {
      type: 'object',
      properties: {
        specialty: { type: 'string', description: 'Filter by specialty text (e.g. "Addiction Counselor")' },
        search: { type: 'string', description: 'Search by practitioner name' },
      },
    },
  },
};

const TOOL_GET_AVAILABLE_SLOTS: OpenRouterTool = {
  type: 'function',
  function: {
    name: 'get_available_slots',
    description: 'Get available appointment time slots for a practitioner on a specific date',
    parameters: {
      type: 'object',
      properties: {
        practitionerId: { type: 'string', description: 'Practitioner UUID' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        serviceId: { type: 'string', description: 'Service UUID to determine slot duration' },
      },
      required: ['practitionerId', 'date'],
    },
  },
};

const TOOL_CREATE_BOOKING: OpenRouterTool = {
  type: 'function',
  function: {
    name: 'create_booking',
    description: 'Book a new appointment for the patient',
    parameters: {
      type: 'object',
      properties: {
        practitionerId: { type: 'string', description: 'Practitioner UUID' },
        serviceId: { type: 'string', description: 'Service UUID' },
        type: {
          type: 'string',
          enum: ['clinic_visit', 'phone_consultation', 'video_consultation'],
          description: 'Appointment type',
        },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        startTime: { type: 'string', description: 'Time in HH:mm format' },
        notes: { type: 'string', description: 'Optional patient notes' },
      },
      required: ['practitionerId', 'serviceId', 'type', 'date', 'startTime'],
    },
  },
};

const TOOL_GET_MY_BOOKINGS: OpenRouterTool = {
  type: 'function',
  function: {
    name: 'get_my_upcoming_bookings',
    description: 'Show the patient their upcoming appointments',
    parameters: { type: 'object', properties: {} },
  },
};

const TOOL_RESCHEDULE_BOOKING: OpenRouterTool = {
  type: 'function',
  function: {
    name: 'reschedule_booking',
    description: 'Change the date or time of an existing booking',
    parameters: {
      type: 'object',
      properties: {
        bookingId: { type: 'string', description: 'Booking UUID' },
        newDate: { type: 'string', description: 'New date in YYYY-MM-DD format' },
        newStartTime: { type: 'string', description: 'New time in HH:mm format' },
      },
      required: ['bookingId'],
    },
  },
};

const TOOL_REQUEST_CANCELLATION: OpenRouterTool = {
  type: 'function',
  function: {
    name: 'request_cancellation',
    description: 'Submit a cancellation request for a booking. The cancellation requires admin approval — it is NOT executed immediately.',
    parameters: {
      type: 'object',
      properties: {
        bookingId: { type: 'string', description: 'Booking UUID' },
        reason: { type: 'string', description: 'Reason for cancellation' },
      },
      required: ['bookingId'],
    },
  },
};

const TOOL_SEARCH_KB: OpenRouterTool = {
  type: 'function',
  function: {
    name: 'search_knowledge_base',
    description: 'Search the clinic knowledge base for information about services, policies, FAQ, etc.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The question or topic to search for' },
      },
      required: ['query'],
    },
  },
};

const TOOL_HANDOFF: OpenRouterTool = {
  type: 'function',
  function: {
    name: 'handoff_to_human',
    description: 'Transfer the conversation to a human agent or provide contact information when you cannot help further',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why the handoff is needed' },
      },
      required: ['reason'],
    },
  },
};

/**
 * Builds the tool list dynamically based on chatbot config rules.
 * If a capability is disabled, the corresponding tool is excluded.
 */
export function buildToolDefinitions(config: ChatbotConfigMap): OpenRouterTool[] {
  const tools: OpenRouterTool[] = [
    TOOL_LIST_PRACTITIONERS,
    TOOL_GET_AVAILABLE_SLOTS,
    TOOL_GET_MY_BOOKINGS,
    TOOL_SEARCH_KB,
    TOOL_HANDOFF,
  ];

  if (config.can_view_prices) {
    tools.push(TOOL_LIST_SERVICES);
  }

  if (config.can_book) {
    tools.push(TOOL_CREATE_BOOKING);
  }

  if (config.can_reschedule) {
    tools.push(TOOL_RESCHEDULE_BOOKING);
  }

  if (config.can_request_cancel) {
    tools.push(TOOL_REQUEST_CANCELLATION);
  }

  return tools;
}
