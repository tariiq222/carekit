process.env.TENANT_ENFORCEMENT ??= 'permissive';
process.env.DEFAULT_ORGANIZATION_ID ??= '00000000-0000-0000-0000-000000000001';
process.env.ADMIN_HOSTS ??= 'localhost,admin.carekit.app';

process.env.DATABASE_URL ??= 'postgresql://carekit:carekit_dev_password@127.0.0.1:5999/carekit_test?schema=public';
process.env.REDIS_HOST ??= 'localhost';
process.env.REDIS_PORT ??= '5380';
process.env.MINIO_ENDPOINT ??= 'localhost';
process.env.MINIO_PORT ??= '9000';
process.env.MINIO_ACCESS_KEY ??= 'minioadmin';
process.env.MINIO_SECRET_KEY ??= 'minioadmin123';
process.env.MINIO_BUCKET ??= 'carekit';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-32chars-min';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-32chars-min';
process.env.JWT_CLIENT_ACCESS_SECRET ??= 'test-client-access-secret-32chars';
process.env.SMS_PROVIDER_ENCRYPTION_KEY ??= Buffer.alloc(32, 1).toString('base64');
process.env.ZOOM_PROVIDER_ENCRYPTION_KEY ??= Buffer.alloc(32, 2).toString('base64');
process.env.MOYASAR_TENANT_ENCRYPTION_KEY ??= Buffer.alloc(32, 3).toString('base64');
