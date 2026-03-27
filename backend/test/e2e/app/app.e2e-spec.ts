import request from 'supertest';
import {
  API_PREFIX,
  createTestApp,
  closeTestApp,
  type TestApp,
} from '../setup/setup';

describe('App (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  it('GET /health returns 200 with status info', async () => {
    const res = await request(httpServer)
      .get(`${API_PREFIX}/health`)
      .expect(200);

    expect(res.body.data).toHaveProperty('status');
  });
});
