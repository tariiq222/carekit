-- ============================================================
-- Migration: Add notifications, chatbot, favorites permissions
-- and assign them to the correct roles
-- ============================================================

-- Step 1: Insert new permissions (upsert-safe via ON CONFLICT DO NOTHING)
INSERT INTO permissions (id, module, action, description, description_ar, created_at)
VALUES
  -- notifications
  (gen_random_uuid(), 'notifications', 'view',   'View notifications',   'عرض الإشعارات',       NOW()),
  (gen_random_uuid(), 'notifications', 'update', 'Mark notifications as read / update', 'تحديث الإشعارات', NOW()),
  -- chatbot
  (gen_random_uuid(), 'chatbot', 'use',    'Use the chatbot (send messages)', 'استخدام الشات بوت',  NOW()),
  (gen_random_uuid(), 'chatbot', 'view',   'View chatbot sessions (admin)',   'عرض جلسات الشات بوت', NOW()),
  (gen_random_uuid(), 'chatbot', 'create', 'Create chatbot sessions',         'إنشاء جلسات الشات بوت', NOW()),
  (gen_random_uuid(), 'chatbot', 'edit',   'Edit chatbot sessions',           'تعديل جلسات الشات بوت', NOW()),
  (gen_random_uuid(), 'chatbot', 'delete', 'Delete chatbot sessions',         'حذف جلسات الشات بوت', NOW()),
  -- practitioners favorites
  (gen_random_uuid(), 'practitioners', 'favorites:view', 'View favorite practitioners', 'عرض الأطباء المفضلين', NOW()),
  (gen_random_uuid(), 'practitioners', 'favorites:edit', 'Add/remove favorite practitioners', 'إضافة/إزالة الأطباء المفضلين', NOW())
ON CONFLICT (module, action) DO NOTHING;

-- ============================================================
-- Step 2: Assign notifications:view to ALL roles
-- ============================================================
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT
  gen_random_uuid(),
  r.id,
  p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.module = 'notifications'
  AND p.action = 'view'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================
-- Step 3: Assign notifications:update to admin + super_admin only
-- ============================================================
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT
  gen_random_uuid(),
  r.id,
  p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.module = 'notifications'
  AND p.action = 'update'
  AND r.slug IN ('super_admin', 'admin')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================
-- Step 4: Assign chatbot:use + chatbot:create to ALL roles
-- (everyone can use the chatbot)
-- ============================================================
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT
  gen_random_uuid(),
  r.id,
  p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.module = 'chatbot'
  AND p.action IN ('use', 'create')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================
-- Step 5: Assign chatbot:view + chatbot:edit + chatbot:delete
-- to admin + super_admin only
-- ============================================================
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT
  gen_random_uuid(),
  r.id,
  p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.module = 'chatbot'
  AND p.action IN ('view', 'edit', 'delete')
  AND r.slug IN ('super_admin', 'admin')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================
-- Step 6: Assign practitioners:favorites:view + favorites:edit
-- to patient + super_admin + admin
-- ============================================================
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT
  gen_random_uuid(),
  r.id,
  p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.module = 'practitioners'
  AND p.action IN ('favorites:view', 'favorites:edit')
  AND r.slug IN ('super_admin', 'admin', 'patient')
ON CONFLICT (role_id, permission_id) DO NOTHING;
