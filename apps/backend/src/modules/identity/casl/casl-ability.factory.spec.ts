import { CaslAbilityFactory } from './casl-ability.factory';

describe('CaslAbilityFactory', () => {
  const factory = new CaslAbilityFactory();

  it('grants manage all for SUPER_ADMIN', () => {
    const ability = factory.buildForUser({ role: 'SUPER_ADMIN', customRole: null });
    expect(ability.can('manage', 'all')).toBe(true);
  });

  it('grants specific permissions from custom role', () => {
    const ability = factory.buildForUser({
      role: 'RECEPTIONIST',
      customRole: { permissions: [{ action: 'create', subject: 'Booking' }, { action: 'read', subject: 'Client' }] },
    });
    expect(ability.can('create', 'Booking')).toBe(true);
    expect(ability.can('read', 'Client')).toBe(true);
    expect(ability.can('delete', 'Booking')).toBe(false);
  });

  it('grants read on own domain for EMPLOYEE', () => {
    const ability = factory.buildForUser({ role: 'EMPLOYEE', customRole: null });
    expect(ability.can('read', 'Booking')).toBe(true);
    expect(ability.can('delete', 'Invoice')).toBe(false);
  });

  it('grants full finance access for ACCOUNTANT', () => {
    const ability = factory.buildForUser({ role: 'ACCOUNTANT', customRole: null });
    expect(ability.can('manage', 'Invoice')).toBe(true);
    expect(ability.can('manage', 'Payment')).toBe(true);
  });
});
