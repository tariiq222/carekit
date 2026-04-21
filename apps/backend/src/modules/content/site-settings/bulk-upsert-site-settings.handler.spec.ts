import { BulkUpsertSiteSettingsHandler } from './bulk-upsert-site-settings.handler';

const buildPrisma = () => {
  const upsert = jest.fn().mockResolvedValue({});
  return {
    upsert,
    prisma: {
      siteSetting: { upsert },
      $transaction: jest.fn(async (calls: Promise<unknown>[]) => Promise.all(calls)),
    },
  };
};

describe('BulkUpsertSiteSettingsHandler', () => {
  it('upserts every entry inside a single transaction', async () => {
    const { prisma, upsert } = buildPrisma();
    const handler = new BulkUpsertSiteSettingsHandler(prisma as never);
    const result = await handler.execute({
      entries: [
        { key: 'home.hero.title.ar', valueAr: 'عنوان' },
        { key: 'home.hero.heroImageUrl', valueMedia: 'https://cdn/hero.png' },
      ],
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenNthCalledWith(1, {
      where: { key: 'home.hero.title.ar' },
      create: expect.objectContaining({ key: 'home.hero.title.ar', valueAr: 'عنوان' }),
      update: expect.objectContaining({ valueAr: 'عنوان' }),
    });
    expect(result).toEqual({ updated: 2 });
  });

  it('normalizes missing values to null', async () => {
    const { prisma, upsert } = buildPrisma();
    const handler = new BulkUpsertSiteSettingsHandler(prisma as never);
    await handler.execute({ entries: [{ key: 'k' }] });
    const args = upsert.mock.calls[0]![0];
    expect(args.create.valueText).toBeNull();
    expect(args.create.valueAr).toBeNull();
    expect(args.create.valueEn).toBeNull();
    expect(args.create.valueMedia).toBeNull();
  });
});
