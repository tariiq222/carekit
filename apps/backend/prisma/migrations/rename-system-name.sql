-- Unify redundant naming config keys into system_name / system_name_ar
-- Removes app_name / app_name_en (duplicates of clinic_name)

UPDATE "white_label_config" SET key = 'system_name' WHERE key = 'clinic_name';
UPDATE "white_label_config" SET key = 'system_name_ar' WHERE key = 'clinic_name_ar';
DELETE FROM "white_label_config" WHERE key IN ('app_name', 'app_name_en');
