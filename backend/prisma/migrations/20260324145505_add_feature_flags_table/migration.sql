-- CreateTable
CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description_ar" TEXT,
    "description_en" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- Seed default feature flags
INSERT INTO "feature_flags" ("id", "key", "enabled", "name_ar", "name_en", "description_ar", "description_en", "created_at", "updated_at") VALUES
  (gen_random_uuid(), 'waitlist',       false, 'قائمة الانتظار',       'Waitlist',           'السماح للمرضى بالانضمام لقائمة الانتظار عند عدم توفر مواعيد', 'Allow patients to join a waitlist when no slots are available', NOW(), NOW()),
  (gen_random_uuid(), 'coupons',        true,  'الكوبونات',            'Coupons',            'تفعيل نظام كوبونات الخصم',                                    'Enable discount coupon system',                                 NOW(), NOW()),
  (gen_random_uuid(), 'gift_cards',     true,  'بطاقات الهدايا',       'Gift Cards',         'تفعيل نظام بطاقات الهدايا المدفوعة مسبقاً',                   'Enable prepaid gift card system',                               NOW(), NOW()),
  (gen_random_uuid(), 'intake_forms',   true,  'نماذج الاستقبال',      'Intake Forms',       'تفعيل استبيانات ما قبل الموعد لكل خدمة',                      'Enable pre-appointment questionnaires per service',             NOW(), NOW()),
  (gen_random_uuid(), 'chatbot',        true,  'الشات بوت',            'AI Chatbot',         'تفعيل المساعد الذكي للمرضى',                                  'Enable AI assistant for patients',                              NOW(), NOW()),
  (gen_random_uuid(), 'live_chat',      false, 'المحادثة المباشرة',    'Live Chat',          'تفعيل تحويل المحادثة من الشات بوت لموظف مباشر',               'Enable chatbot handoff to live agent',                          NOW(), NOW()),
  (gen_random_uuid(), 'ratings',        true,  'التقييمات والبلاغات',  'Ratings & Reports',  'تفعيل تقييم المرضى للأطباء وبلاغات المشاكل',                  'Enable patient ratings and problem reports',                    NOW(), NOW()),
  (gen_random_uuid(), 'multi_branch',   false, 'تعدد الفروع',         'Multi-Branch',       'تفعيل إدارة فروع متعددة للعيادة',                             'Enable multi-branch clinic management',                         NOW(), NOW()),
  (gen_random_uuid(), 'recurring',      false, 'الحجز المتكرر',       'Recurring Booking',  'السماح بإنشاء مواعيد متكررة أسبوعياً',                         'Allow creating weekly recurring appointments',                  NOW(), NOW()),
  (gen_random_uuid(), 'walk_in',        true,  'الحضور بدون موعد',    'Walk-in',            'السماح بتسجيل مرضى حضروا بدون موعد مسبق',                     'Allow registering patients who arrive without appointment',     NOW(), NOW());
