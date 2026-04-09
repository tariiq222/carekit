/**
 * Query Keys — CareKit Dashboard
 *
 * Centralized query key factory for TanStack Query.
 * Ensures consistent keys for cache invalidation.
 */

export const queryKeys = {
  /* ─── Bookings ─── */
  bookings: {
    all: ["bookings"] as const,
    list: (filters?: object) =>
      ["bookings", "list", filters] as const,
    detail: (id: string) => ["bookings", "detail", id] as const,
    stats: () => ["bookings", "stats"] as const,
    statusLog: (id: string) => ["bookings", "status-log", id] as const,
  },

  /* ─── Patients ─── */
  patients: {
    all: ["patients"] as const,
    list: (filters?: object) =>
      ["patients", "list", filters] as const,
    listStats: () => ["patients", "list-stats"] as const,
    detail: (id: string) => ["patients", "detail", id] as const,
    stats: (id: string) => ["patients", "stats", id] as const,
    bookings: (id: string) => ["patients", "detail", id, "bookings"] as const,
  },

  /* ─── Practitioners ─── */
  practitioners: {
    all: ["practitioners"] as const,
    list: (filters?: object) =>
      ["practitioners", "list", filters] as const,
    detail: (id: string) => ["practitioners", "detail", id] as const,
    availability: (id: string) =>
      ["practitioners", "availability", id] as const,
    slots: (id: string, date: string) =>
      ["practitioners", "slots", id, date] as const,
    breaks: (id: string) =>
      ["practitioners", "breaks", id] as const,
    vacations: (id: string) =>
      ["practitioners", "vacations", id] as const,
    services: (id: string) =>
      ["practitioners", "services", id] as const,
    serviceTypes: (practitionerId: string, serviceId: string) =>
      [...["practitioners"] as const, practitionerId, "service-types", serviceId] as const,
    ratings: (id: string) =>
      ["practitioners", "ratings", id] as const,
  },

  /* ─── Services ─── */
  services: {
    all: ["services"] as const,
    list: (filters?: object) =>
      ["services", "list", filters] as const,
    detail: (id: string) => ["services", "detail", id] as const,
    categories: () => ["services", "categories"] as const,
    bookingTypes: (serviceId: string) =>
      ["services", serviceId, "booking-types"] as const,
    durationOptions: (serviceId: string) =>
      ["services", "duration-options", serviceId] as const,
    intakeForms: (serviceId: string) =>
      ["services", "intake-forms", serviceId] as const,
    intakeResponses: (bookingId: string) =>
      ["services", "intake-responses", bookingId] as const,
    practitioners: (serviceId: string) =>
      ["services", "practitioners", serviceId] as const,
  },

  /* ─── Payments ─── */
  payments: {
    all: ["payments"] as const,
    list: (filters?: object) =>
      ["payments", "list", filters] as const,
    detail: (id: string) => ["payments", "detail", id] as const,
    stats: () => ["payments", "stats"] as const,
    byBooking: (bookingId: string) =>
      ["payments", "booking", bookingId] as const,
  },

  /* ─── Invoices ─── */
  invoices: {
    all: ["invoices"] as const,
    list: (filters?: object) =>
      ["invoices", "list", filters] as const,
    detail: (id: string) => ["invoices", "detail", id] as const,
    stats: () => ["invoices", "stats"] as const,
    html: (id: string) => ["invoices", "html", id] as const,
  },

  /* ─── Users ─── */
  users: {
    all: ["users"] as const,
    list: (filters?: object) =>
      ["users", "list", filters] as const,
    detail: (id: string) => ["users", "detail", id] as const,
  },

  /* ─── Roles ─── */
  roles: {
    all: ["roles"] as const,
    list: () => ["roles", "list"] as const,
  },

  /* ─── Permissions ─── */
  permissions: {
    all: ["permissions"] as const,
    list: () => ["permissions", "list"] as const,
  },

  /* ─── Notifications ─── */
  notifications: {
    all: ["notifications"] as const,
    list: (filters?: object) =>
      ["notifications", "list", filters] as const,
    unreadCount: () => ["notifications", "unread-count"] as const,
  },

  /* ─── Reports ─── */
  reports: {
    revenue: (filters?: object) =>
      ["reports", "revenue", filters] as const,
    bookings: (filters?: object) =>
      ["reports", "bookings", filters] as const,
    practitioner: (id: string, filters?: object) =>
      ["reports", "practitioner", id, filters] as const,
  },

  /* ─── Chatbot ─── */
  chatbot: {
    sessions: {
      all: ["chatbot", "sessions"] as const,
      list: (filters?: object) =>
        ["chatbot", "sessions", "list", filters] as const,
      detail: (id: string) =>
        ["chatbot", "sessions", "detail", id] as const,
    },
    knowledgeBase: {
      all: ["chatbot", "knowledge-base"] as const,
      list: (filters?: object) =>
        ["chatbot", "knowledge-base", "list", filters] as const,
    },
    files: {
      all: ["chatbot", "files"] as const,
      list: (filters?: object) =>
        ["chatbot", "files", "list", filters] as const,
    },
    config: {
      all: ["chatbot", "config"] as const,
      byCategory: (category: string) =>
        ["chatbot", "config", category] as const,
    },
    analytics: {
      all: (filters?: object) =>
        ["chatbot", "analytics", filters] as const,
      questions: (limit?: number) =>
        ["chatbot", "analytics", "questions", limit] as const,
    },
  },

  /* ─── Problem Reports ─── */
  problemReports: {
    all: ["problem-reports"] as const,
    list: (filters?: object) =>
      ["problem-reports", "list", filters] as const,
    detail: (id: string) => ["problem-reports", "detail", id] as const,
  },

  /* ─── Clinic ─── */
  clinic: {
    all: ["clinic"] as const,
    hours: () => ["clinic-hours"] as const,
    holidays: (year?: number) => ["clinic-holidays", year] as const,
  },

  /* ─── Gift Cards ─── */
  giftCards: {
    all: ["gift-cards"] as const,
    list: (filters?: object) =>
      ["gift-cards", "list", filters] as const,
    detail: (id: string) => ["gift-cards", "detail", id] as const,
  },

  /* ─── Coupons ─── */
  coupons: {
    all: ["coupons"] as const,
    list: (filters?: object) =>
      ["coupons", "list", filters] as const,
    detail: (id: string) => ["coupons", "detail", id] as const,
  },

  /* ─── Branches ─── */
  branches: {
    all: ["branches"] as const,
    list: (filters?: object) =>
      ["branches", "list", filters] as const,
    detail: (id: string) => ["branches", "detail", id] as const,
    practitioners: (id: string) =>
      ["branches", "practitioners", id] as const,
  },

  /* ─── Departments ─── */
  departments: {
    all: ["departments"] as const,
    list: (filters?: object) =>
      ["departments", "list", filters] as const,
    detail: (id: string) => ["departments", "detail", id] as const,
  },

  /* ─── Email Templates ─── */
  emailTemplates: {
    all: ["email-templates"] as const,
    list: () => ["email-templates", "list"] as const,
    detail: (slug: string) => ["email-templates", "detail", slug] as const,
  },

  /* ─── WhiteLabel ─── */
  whitelabel: {
    all: ["whitelabel"] as const,
    config: () => ["whitelabel", "config"] as const,
  },

  /* ─── Waitlist ─── */
  waitlist: {
    all: ["waitlist"] as const,
    list: (filters?: object) => ["waitlist", "list", filters] as const,
  },

  /* ─── Intake Forms ─── */
  intakeForms: {
    all: ["intake-forms"] as const,
    list: (filters?: object) => ["intake-forms", "list", filters] as const,
    detail: (id: string) => ["intake-forms", "detail", id] as const,
    responses: (bookingId: string) =>
      ["intake-forms", "responses", bookingId] as const,
  },

  /* ─── Booking Settings ─── */
  bookingSettings: {
    all: ["booking-settings"] as const,
    detail: () => ["booking-settings", "detail"] as const,
  },

  /* ─── Clinic Settings ─── */
  clinicSettings: {
    all: ["clinic-settings"] as const,
    config: () => ["clinic-settings", "config"] as const,
    public: () => ["clinic-settings", "public"] as const,
    bookingFlowOrder: () => ["clinic-settings", "booking-flow-order"] as const,
    payment: () => ["clinic-settings", "payment"] as const,
  },

  /* ─── Clinic Integrations ─── */
  clinicIntegrations: {
    all: ["clinic-integrations"] as const,
    config: () => ["clinic-integrations", "config"] as const,
  },

  /* ─── License ─── */
  license: {
    all: ["license"] as const,
    config: () => ["license", "config"] as const,
    features: () => ["license", "features"] as const,
  },

  /* ─── Widget ─── */
  widget: {
    branding: () => ["widget", "branding"] as const,
    settings: () => ["clinic-settings", "widget"] as const,
  },

  /* ─── Clinic Public Settings ─── */
  clinicPublic: {
    settings: () => ["clinic-settings", "public"] as const,
  },

} as const
