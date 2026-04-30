import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AddSavedCardHandler } from './add-saved-card.handler';
import { ListSavedCardsHandler } from './list-saved-cards.handler';
import { RemoveSavedCardHandler } from './remove-saved-card.handler';
import { SetDefaultSavedCardHandler } from './set-default-saved-card.handler';

const tokenMeta = {
  id: 'token_abc',
  brand: 'visa',
  last4: '1111',
  expiryMonth: 12,
  expiryYear: 2030,
  holderName: 'Clinic Owner',
  status: 'active',
};

const savedCard = {
  id: 'card-1',
  organizationId: 'org-1',
  moyasarTokenId: 'token_abc',
  last4: '1111',
  brand: 'visa',
  expiryMonth: 12,
  expiryYear: 2030,
  holderName: 'Clinic Owner',
  isDefault: true,
  createdAt: new Date('2026-04-01T00:00:00.000Z'),
};

type TransactionCallback<T> = (tx: T) => Promise<unknown>;

const buildTenant = (organizationId = 'org-1') => ({
  requireOrganizationId: jest.fn().mockReturnValue(organizationId),
});

const buildCache = () => ({
  invalidate: jest.fn(),
});

const buildConfig = () => ({
  get: jest.fn((key: string, fallback?: string) => {
    if (key === 'BACKEND_URL') return 'https://api.webvue.pro';
    return fallback;
  }),
});

function buildAddHarness() {
  const prisma = {
    savedCard: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'card-1', ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    subscription: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: TransactionCallback<typeof prisma>) =>
    fn(prisma),
  );
  const moyasar = {
    getToken: jest.fn().mockResolvedValue(tokenMeta),
    chargeWithToken: jest.fn().mockResolvedValue({ id: 'pay_1', status: 'paid' }),
    refundPayment: jest.fn().mockResolvedValue({ id: 'ref_1', amount: 100, status: 'refunded' }),
  };
  const cache = buildCache();
  const handler = new AddSavedCardHandler(
    prisma as never,
    buildTenant() as never,
    cache as never,
    moyasar as never,
    buildConfig() as never,
  );
  return { handler, prisma, cache, moyasar };
}

function buildListHarness() {
  const prisma = {
    savedCard: {
      findMany: jest.fn().mockResolvedValue([savedCard]),
    },
  };
  const handler = new ListSavedCardsHandler(prisma as never, buildTenant() as never);
  return { handler, prisma };
}

function buildSetDefaultHarness() {
  const prisma = {
    savedCard: {
      findFirst: jest.fn().mockResolvedValue({ ...savedCard, id: 'card-2', moyasarTokenId: 'token_2' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({ ...savedCard, id: 'card-2', isDefault: true }),
    },
    subscription: {
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: TransactionCallback<typeof prisma>) =>
    fn(prisma),
  );
  const cache = buildCache();
  const handler = new SetDefaultSavedCardHandler(
    prisma as never,
    buildTenant() as never,
    cache as never,
  );
  return { handler, prisma, cache };
}

function buildRemoveHarness(options?: {
  cardCount?: number;
  deletingDefault?: boolean;
  replacement?: { id: string; moyasarTokenId: string } | null;
  subscriptionStatus?: string;
}) {
  const cardCount = options?.cardCount ?? 2;
  const deletingDefault = options?.deletingDefault ?? false;
  const replacement = options?.replacement ?? { id: 'card-2', moyasarTokenId: 'token_2' };
  const prisma = {
    savedCard: {
      findFirst: jest.fn().mockResolvedValue({
        ...savedCard,
        isDefault: deletingDefault,
        moyasarTokenId: 'token_1',
      }),
      count: jest.fn().mockResolvedValue(cardCount),
      findMany: jest.fn().mockResolvedValue(replacement ? [replacement] : []),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    subscription: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'sub-1',
        status: options?.subscriptionStatus ?? 'TRIALING',
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: TransactionCallback<typeof prisma>) =>
    fn(prisma),
  );
  const moyasar = {
    deleteToken: jest.fn().mockResolvedValue(undefined),
  };
  const cache = buildCache();
  const handler = new RemoveSavedCardHandler(
    prisma as never,
    buildTenant() as never,
    cache as never,
    moyasar as never,
  );
  return { handler, prisma, cache, moyasar };
}

describe('AddSavedCardHandler', () => {
  it('fetches token metadata, verifies with Moyasar charge/refund, and creates default card', async () => {
    const { handler, prisma, moyasar, cache } = buildAddHarness();

    await handler.execute({
      moyasarTokenId: 'token_abc',
      makeDefault: true,
      idempotencyKey: '1f210deb-3501-4c46-8fd5-2f89f318a39b',
    });

    expect(moyasar.getToken).toHaveBeenCalledWith('token_abc');
    expect(moyasar.chargeWithToken).toHaveBeenCalledWith(expect.objectContaining({
      token: 'token_abc',
      amount: 100,
      currency: 'SAR',
      givenId: '1f210deb-3501-4c46-8fd5-2f89f318a39b',
      idempotencyKey: '1f210deb-3501-4c46-8fd5-2f89f318a39b',
    }));
    expect(moyasar.refundPayment).toHaveBeenCalledWith(expect.objectContaining({
      paymentId: 'pay_1',
      amountHalalas: 100,
    }));
    expect(prisma.savedCard.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organizationId: 'org-1',
        moyasarTokenId: 'token_abc',
        last4: '1111',
        brand: 'visa',
        isDefault: true,
      }),
    }));
    expect(prisma.subscription.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: 'org-1' },
      data: expect.objectContaining({
        defaultSavedCardId: 'card-1',
        moyasarCardTokenRef: 'token_abc',
      }),
    }));
    expect(cache.invalidate).toHaveBeenCalledWith('org-1');
  });

  it('rejects expired token metadata before creating card', async () => {
    const { handler, prisma, moyasar } = buildAddHarness();
    moyasar.getToken.mockResolvedValue({ ...tokenMeta, expiryYear: 2020 });

    await expect(handler.execute({ moyasarTokenId: 'token_old' })).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(prisma.savedCard.create).not.toHaveBeenCalled();
  });

  it('rejects 3DS initiated verification instead of storing a card as paid', async () => {
    const { handler, prisma, moyasar } = buildAddHarness();
    moyasar.chargeWithToken.mockResolvedValue({
      id: 'pay_3ds',
      status: 'initiated',
      transactionUrl: 'https://api.moyasar.com/3ds',
    });

    await expect(handler.execute({ moyasarTokenId: 'token_abc' })).rejects.toThrow(
      'saved_card_verification_requires_retry',
    );
    expect(prisma.savedCard.create).not.toHaveBeenCalled();
    expect(moyasar.refundPayment).not.toHaveBeenCalled();
  });

  it('re-arms dunning immediately when adding a default card to a past-due subscription', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-30T12:00:00.000Z'));
    const { handler, prisma } = buildAddHarness();
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'PAST_DUE',
    });

    await handler.execute({
      moyasarTokenId: 'token_abc',
      makeDefault: true,
      idempotencyKey: '1f210deb-3501-4c46-8fd5-2f89f318a39b',
    });

    expect(prisma.subscription.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: 'org-1' },
      data: expect.objectContaining({
        dunningRetryCount: 0,
        nextRetryAt: new Date('2026-04-30T12:00:00.000Z'),
      }),
    }));
    jest.useRealTimers();
  });
});

describe('ListSavedCardsHandler', () => {
  it('lists cards for the current organization newest/default first', async () => {
    const { handler, prisma } = buildListHarness();

    await handler.execute();

    expect(prisma.savedCard.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: 'org-1' },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    }));
  });
});

describe('SetDefaultSavedCardHandler', () => {
  it('sets exactly one default card and syncs subscription token fields', async () => {
    const { handler, prisma, cache } = buildSetDefaultHarness();

    await handler.execute('card-2');

    expect(prisma.savedCard.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'card-2', organizationId: 'org-1' },
    }));
    expect(prisma.savedCard.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: 'org-1', isDefault: true },
      data: { isDefault: false },
    }));
    expect(prisma.savedCard.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'card-2' },
      data: { isDefault: true },
    }));
    expect(prisma.subscription.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: 'org-1' },
      data: { defaultSavedCardId: 'card-2', moyasarCardTokenRef: 'token_2' },
    }));
    expect(cache.invalidate).toHaveBeenCalledWith('org-1');
  });

  it('throws NotFoundException when the card is outside the current organization', async () => {
    const { handler, prisma } = buildSetDefaultHarness();
    prisma.savedCard.findFirst.mockResolvedValue(null);

    await expect(handler.execute('card-missing')).rejects.toThrow(NotFoundException);
  });
});

describe('RemoveSavedCardHandler', () => {
  it('blocks deleting the last card when subscription is active', async () => {
    const { handler, prisma, moyasar } = buildRemoveHarness({
      cardCount: 1,
      subscriptionStatus: 'ACTIVE',
    });

    await expect(handler.execute('card-1')).rejects.toThrow('last_saved_card_required');
    expect(prisma.savedCard.delete).not.toHaveBeenCalled();
    expect(moyasar.deleteToken).not.toHaveBeenCalled();
  });

  it('auto-promotes newest remaining card when deleting the default card', async () => {
    const { handler, prisma } = buildRemoveHarness({
      cardCount: 2,
      deletingDefault: true,
      replacement: { id: 'card-2', moyasarTokenId: 'token_2' },
    });

    await handler.execute('card-1');

    expect(prisma.savedCard.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'card-2' },
      data: { isDefault: true },
    }));
    expect(prisma.subscription.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: 'org-1' },
      data: { defaultSavedCardId: 'card-2', moyasarCardTokenRef: 'token_2' },
    }));
  });

  it('deletes the Moyasar token after DB deletion succeeds', async () => {
    const { handler, prisma, moyasar, cache } = buildRemoveHarness({ cardCount: 2 });

    await handler.execute('card-1');

    expect(prisma.savedCard.delete).toHaveBeenCalledWith({
      where: { id: 'card-1' },
    });
    expect(moyasar.deleteToken).toHaveBeenCalledWith('token_1');
    expect(cache.invalidate).toHaveBeenCalledWith('org-1');
  });
});
