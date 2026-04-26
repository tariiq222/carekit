import { envValidationSchema } from '@/config/env.validation';

describe('envValidationSchema', () => {
  const devEnv = {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://localhost:5432/test',
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379',
    MINIO_ENDPOINT: 'localhost',
    MINIO_PORT: '9000',
    MINIO_ACCESS_KEY: 'a',
    MINIO_SECRET_KEY: 'b',
    MINIO_BUCKET: 'x',
    JWT_ACCESS_SECRET: 'dev-access-secret-change-me',
    JWT_REFRESH_SECRET: 'dev-refresh-secret-change-me',
    JWT_CLIENT_ACCESS_SECRET: 'dev-client-access-secret-change-me',
    SMS_PROVIDER_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
    ZOOM_PROVIDER_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
  };

  it('passes minimal dev env', () => {
    const r = envValidationSchema.validate(devEnv, { abortEarly: false });
    expect(r.error).toBeUndefined();
  });

  it('rejects production env with placeholder secrets', () => {
    const env = { ...devEnv, NODE_ENV: 'production',
      CORS_ORIGINS: 'https://app.example.com',
      ADMIN_HOSTS: 'admin.example.com',
      AUTHENTICA_API_KEY: 'real-key-1234567890',
      CAPTCHA_PROVIDER: 'hcaptcha',
      HCAPTCHA_SECRET: 'real-hcaptcha-secret',
      JWT_OTP_SECRET: 'a-real-otp-secret-32-bytes-or-more',
      DASHBOARD_PUBLIC_URL: 'https://app.example.com',
      PUBLIC_WEBSITE_URL: 'https://example.com',
    };
    const r = envValidationSchema.validate(env, { abortEarly: false });
    expect(r.error).toBeDefined();
    expect(r.error!.message).toMatch(/dev placeholder|change-me|invalid/i);
  });

  it('passes production env with real secrets', () => {
    const env = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://localhost:5432/test',
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
      MINIO_ENDPOINT: 'localhost',
      MINIO_PORT: '9000',
      MINIO_ACCESS_KEY: 'a',
      MINIO_SECRET_KEY: 'b',
      MINIO_BUCKET: 'x',
      JWT_ACCESS_SECRET: 'a-real-jwt-secret-32-bytes-long-here',
      JWT_REFRESH_SECRET: 'a-real-refresh-secret-32-bytes-long',
      JWT_CLIENT_ACCESS_SECRET: 'a-real-client-secret-32-bytes-long',
      JWT_OTP_SECRET: 'a-real-otp-secret-32-bytes-or-more',
      SMS_PROVIDER_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
      ZOOM_PROVIDER_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
      CORS_ORIGINS: 'https://app.example.com',
      ADMIN_HOSTS: 'admin.example.com',
      AUTHENTICA_API_KEY: 'real-authentica-key-1234567890',
      CAPTCHA_PROVIDER: 'hcaptcha',
      HCAPTCHA_SECRET: 'real-hcaptcha-secret',
      DASHBOARD_PUBLIC_URL: 'https://app.example.com',
      PUBLIC_WEBSITE_URL: 'https://example.com',
    };
    const r = envValidationSchema.validate(env, { abortEarly: false });
    expect(r.error).toBeUndefined();
  });

  it('rejects production env missing AUTHENTICA_API_KEY', () => {
    const env = { ...devEnv, NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'a-real-jwt-secret-32-bytes-long-here',
      JWT_REFRESH_SECRET: 'a-real-refresh-secret-32-bytes-long',
      JWT_CLIENT_ACCESS_SECRET: 'a-real-client-secret-32-bytes-long',
      JWT_OTP_SECRET: 'a-real-otp-secret-32-bytes-or-more',
      CORS_ORIGINS: 'https://app.example.com',
      ADMIN_HOSTS: 'admin.example.com',
      CAPTCHA_PROVIDER: 'hcaptcha',
      HCAPTCHA_SECRET: 'real-hcaptcha-secret',
      DASHBOARD_PUBLIC_URL: 'https://app.example.com',
      PUBLIC_WEBSITE_URL: 'https://example.com',
    };
    const r = envValidationSchema.validate(env, { abortEarly: false });
    expect(r.error).toBeDefined();
    expect(r.error!.message).toMatch(/AUTHENTICA_API_KEY/);
  });

  it('rejects production env with hcaptcha provider but missing HCAPTCHA_SECRET', () => {
    const env = { ...devEnv, NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'a-real-jwt-secret-32-bytes-long-here',
      JWT_REFRESH_SECRET: 'a-real-refresh-secret-32-bytes-long',
      JWT_CLIENT_ACCESS_SECRET: 'a-real-client-secret-32-bytes-long',
      JWT_OTP_SECRET: 'a-real-otp-secret-32-bytes-or-more',
      CORS_ORIGINS: 'https://app.example.com',
      ADMIN_HOSTS: 'admin.example.com',
      AUTHENTICA_API_KEY: 'real-authentica-key-1234567890',
      CAPTCHA_PROVIDER: 'hcaptcha',
      DASHBOARD_PUBLIC_URL: 'https://app.example.com',
      PUBLIC_WEBSITE_URL: 'https://example.com',
    };
    const r = envValidationSchema.validate(env, { abortEarly: false });
    expect(r.error).toBeDefined();
    expect(r.error!.message).toMatch(/HCAPTCHA_SECRET/);
  });
});
