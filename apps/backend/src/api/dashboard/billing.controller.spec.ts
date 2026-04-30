import { BillingController } from './billing.controller';

const buildHandler = <T>(value: T) => ({
  execute: jest.fn().mockResolvedValue(value),
});

describe('BillingController saved-card routes', () => {
  it('delegates saved-card routes to handlers', async () => {
    const listSavedCards = buildHandler([{ id: 'card-1' }]);
    const addSavedCard = buildHandler({ id: 'card-2' });
    const setDefaultSavedCard = buildHandler({ id: 'card-2', isDefault: true });
    const removeSavedCard = buildHandler({ ok: true });
    const controller = new BillingController(
      buildHandler([]) as never,
      buildHandler(null) as never,
      buildHandler([]) as never,
      buildHandler(null) as never,
      buildHandler(null) as never,
      buildHandler(null) as never,
      buildHandler(null) as never,
      buildHandler(null) as never,
      listSavedCards as never,
      addSavedCard as never,
      setDefaultSavedCard as never,
      removeSavedCard as never,
    );

    await expect(controller.savedCards()).resolves.toEqual([{ id: 'card-1' }]);
    expect(listSavedCards.execute).toHaveBeenCalled();

    const dto = {
      moyasarTokenId: 'token_abc',
      makeDefault: true,
      idempotencyKey: '1f210deb-3501-4c46-8fd5-2f89f318a39b',
    };
    await controller.addCard(dto);
    expect(addSavedCard.execute).toHaveBeenCalledWith(dto);

    await controller.setDefaultCard('card-2');
    expect(setDefaultSavedCard.execute).toHaveBeenCalledWith('card-2');

    await controller.removeCard('card-2');
    expect(removeSavedCard.execute).toHaveBeenCalledWith('card-2');
  });
});
