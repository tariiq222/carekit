import type { FeatureFlags } from '@carekit/api-client'

export interface NavItem {
  key: string
  labelAr: string
  labelEn: string
  icon: string
  path: string
  flag: keyof FeatureFlags | null
}

export interface NavGroup {
  key: string
  labelAr: string
  labelEn: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'main',
    labelAr: 'الرئيسية',
    labelEn: 'Main',
    items: [
      { key: 'dashboard', labelAr: 'لوحة التحكم', labelEn: 'Dashboard', icon: 'hgi-dashboard-square-01', path: '/', flag: null },
    ],
  },
  {
    key: 'operations',
    labelAr: 'العمليات',
    labelEn: 'Operations',
    items: [
      { key: 'bookings', labelAr: 'الحجوزات', labelEn: 'Bookings', icon: 'hgi-calendar-03', path: '/bookings', flag: 'bookings' },
      { key: 'patients', labelAr: 'المرضى', labelEn: 'Patients', icon: 'hgi-user-multiple-02', path: '/patients', flag: 'patients' },
      { key: 'practitioners', labelAr: 'الممارسون', labelEn: 'Practitioners', icon: 'hgi-doctor-01', path: '/practitioners', flag: 'practitioners' },
      { key: 'groupSessions', labelAr: 'الجلسات الجماعية', labelEn: 'Group Sessions', icon: 'hgi-user-group', path: '/group-sessions', flag: 'groupSessions' },
      { key: 'departments', labelAr: 'الأقسام', labelEn: 'Departments', icon: 'hgi-building-04', path: '/departments', flag: 'departments' },
    ],
  },
  {
    key: 'finance',
    labelAr: 'المالية',
    labelEn: 'Finance',
    items: [
      { key: 'payments', labelAr: 'المدفوعات', labelEn: 'Payments', icon: 'hgi-credit-card', path: '/payments', flag: 'payments' },
      { key: 'invoices', labelAr: 'الفواتير', labelEn: 'Invoices', icon: 'hgi-invoice-02', path: '/invoices', flag: 'invoices' },
      { key: 'coupons', labelAr: 'كوبونات الخصم', labelEn: 'Coupons', icon: 'hgi-discount-tag-02', path: '/coupons', flag: 'coupons' },
      { key: 'giftCards', labelAr: 'بطاقات الهدايا', labelEn: 'Gift Cards', icon: 'hgi-gift', path: '/gift-cards', flag: 'giftCards' },
      { key: 'zatca', labelAr: 'ZATCA', labelEn: 'ZATCA', icon: 'hgi-tax-01', path: '/zatca', flag: 'zatca' },
    ],
  },
  {
    key: 'content',
    labelAr: 'المحتوى',
    labelEn: 'Content',
    items: [
      { key: 'services', labelAr: 'الخدمات', labelEn: 'Services', icon: 'hgi-stethoscope-02', path: '/services', flag: 'services' },
      { key: 'branches', labelAr: 'الفروع', labelEn: 'Branches', icon: 'hgi-location-01', path: '/branches', flag: 'branches' },
      { key: 'intakeForms', labelAr: 'نماذج الاستقبال', labelEn: 'Intake Forms', icon: 'hgi-file-01', path: '/intake-forms', flag: 'intakeForms' },
      { key: 'chatbot', labelAr: 'الشاتبوت', labelEn: 'Chatbot', icon: 'hgi-bot', path: '/chatbot', flag: 'chatbot' },
    ],
  },
  {
    key: 'reports',
    labelAr: 'التقارير',
    labelEn: 'Reports',
    items: [
      { key: 'reports', labelAr: 'التقارير والإحصاء', labelEn: 'Reports', icon: 'hgi-chart-bar-01', path: '/reports', flag: 'reports' },
    ],
  },
  {
    key: 'settings',
    labelAr: 'الإعدادات',
    labelEn: 'Settings',
    items: [
      { key: 'users', labelAr: 'المستخدمون والأدوار', labelEn: 'Users & Roles', icon: 'hgi-user-settings-01', path: '/users', flag: 'users' },
      { key: 'clinicSettings', labelAr: 'إعدادات العيادة', labelEn: 'Clinic Settings', icon: 'hgi-settings-02', path: '/settings/clinic', flag: 'clinicSettings' },
      { key: 'whitelabel', labelAr: 'الهوية البصرية', labelEn: 'Visual Identity', icon: 'hgi-paint-brush-02', path: '/settings/whitelabel', flag: 'whitelabel' },
      { key: 'integrations', labelAr: 'التكاملات', labelEn: 'Integrations', icon: 'hgi-plug-01', path: '/settings/integrations', flag: 'integrations' },
      { key: 'emailTemplates', labelAr: 'قوالب البريد', labelEn: 'Email Templates', icon: 'hgi-mail-01', path: '/settings/email-templates', flag: 'emailTemplates' },
      { key: 'ratings', labelAr: 'التقييمات', labelEn: 'Ratings', icon: 'hgi-star', path: '/ratings', flag: 'ratings' },
      { key: 'notifications', labelAr: 'الإشعارات', labelEn: 'Notifications', icon: 'hgi-notification-02', path: '/notifications', flag: 'notifications' },
      { key: 'activityLog', labelAr: 'سجل النشاط', labelEn: 'Activity Log', icon: 'hgi-clock-02', path: '/activity-log', flag: 'activityLog' },
    ],
  },
]
