import SuperTest from 'supertest';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { INestApplication } from '@nestjs/common';
import { configureCors } from '../../src/cors';

describe('CORS — wildcard subdomain', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.PLATFORM_ROOT_DOMAIN = 'deqah.net';
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureCors(app);
    await app.init();
  });
  afterAll(async () => app && (await app.close()));

  it('allows https://sawa.deqah.net', async () => {
    const res = await SuperTest(app.getHttpServer())
      .options('/api/v1/health')
      .set('Origin', 'https://sawa.deqah.net')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).toBe('https://sawa.deqah.net');
  });

  it('blocks https://evil.com', async () => {
    const res = await SuperTest(app.getHttpServer())
      .options('/api/v1/health')
      .set('Origin', 'https://evil.com')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
