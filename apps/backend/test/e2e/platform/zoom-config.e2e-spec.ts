import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';
import { GetZoomConfigHandler } from '../../../src/modules/integrations/zoom/get-zoom-config.handler';
import { UpsertZoomConfigHandler } from '../../../src/modules/integrations/zoom/upsert-zoom-config.handler';
import { ZoomCredentialsService } from '../../../src/infrastructure/zoom/zoom-credentials.service';
import { randomBytes } from 'crypto';

describe('Zoom Integration Config — tenant isolation (e2e)', () => {
  let h: IsolationHarness;
  let getHandler: GetZoomConfigHandler;
  let upsertHandler: UpsertZoomConfigHandler;
  let credentials: ZoomCredentialsService;

  beforeAll(async () => {
    process.env.ZOOM_PROVIDER_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    h = await bootHarness();
    getHandler = h.app.get(GetZoomConfigHandler);
    upsertHandler = h.app.get(UpsertZoomConfigHandler);
    credentials = h.app.get(ZoomCredentialsService);
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  it('Org A config is invisible from Org B', async () => {
    const a = await h.createOrg(`zoom-iso-a-${Date.now()}`, 'منظمة Zoom أ');
    const b = await h.createOrg(`zoom-iso-b-${Date.now()}`, 'منظمة Zoom ب');

    await h.runAs({ organizationId: a.id }, () =>
      upsertHandler.execute({
        zoomClientId: 'org-a-client',
        zoomClientSecret: 'org-a-secret',
        zoomAccountId: 'org-a-account',
      }),
    );

    const fromA = await h.runAs({ organizationId: a.id }, () => getHandler.execute());
    expect(fromA).toEqual({ configured: true, isActive: true });

    const fromB = await h.runAs({ organizationId: b.id }, () => getHandler.execute());
    expect(fromB).toEqual({ configured: false, isActive: false });
  });

  it('Encrypted ciphertext from Org A cannot be decrypted under Org B AAD', async () => {
    const a = await h.createOrg(`zoom-iso-c-${Date.now()}`, 'منظمة Zoom ج');
    const b = await h.createOrg(`zoom-iso-d-${Date.now()}`, 'منظمة Zoom د');

    const ciphertext = credentials.encrypt(
      { zoomClientId: 'cid', zoomClientSecret: 'csec', zoomAccountId: 'acct' },
      a.id,
    );

    // Decrypting with Org B as AAD must fail (GCM auth tag mismatch).
    expect(() =>
      credentials.decrypt(ciphertext, b.id),
    ).toThrow();

    // Decrypting with the original Org A AAD succeeds.
    const plain = credentials.decrypt<{ zoomClientId: string }>(ciphertext, a.id);
    expect(plain.zoomClientId).toBe('cid');
  });

  it('Org B can have its own config independently', async () => {
    const a = await h.createOrg(`zoom-iso-e-${Date.now()}`, 'منظمة Zoom ه');
    const b = await h.createOrg(`zoom-iso-f-${Date.now()}`, 'منظمة Zoom و');

    await h.runAs({ organizationId: a.id }, () =>
      upsertHandler.execute({
        zoomClientId: 'a-client',
        zoomClientSecret: 'a-secret',
        zoomAccountId: 'a-account',
      }),
    );
    await h.runAs({ organizationId: b.id }, () =>
      upsertHandler.execute({
        zoomClientId: 'b-client',
        zoomClientSecret: 'b-secret',
        zoomAccountId: 'b-account',
      }),
    );

    const fromA = await h.runAs({ organizationId: a.id }, () => getHandler.execute());
    const fromB = await h.runAs({ organizationId: b.id }, () => getHandler.execute());

    expect(fromA).toEqual({ configured: true, isActive: true });
    expect(fromB).toEqual({ configured: true, isActive: true });
  });
});
