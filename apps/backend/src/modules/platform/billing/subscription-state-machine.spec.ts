import {
  SubscriptionEvent,
  SubscriptionStateMachine,
  TRANSITIONS,
} from './subscription-state-machine';

describe('SubscriptionStateMachine', () => {
  const sm = new SubscriptionStateMachine();

  describe('happy paths', () => {
    it('transitions TRIALING → ACTIVE on chargeSuccess', () => {
      expect(sm.transition('TRIALING', { type: 'chargeSuccess' })).toBe('ACTIVE');
    });

    it('transitions TRIALING → PAST_DUE on chargeFailure', () => {
      expect(sm.transition('TRIALING', { type: 'chargeFailure' })).toBe('PAST_DUE');
    });

    it('transitions TRIALING → SUSPENDED on trialExpired (no card on file)', () => {
      expect(sm.transition('TRIALING', { type: 'trialExpired' })).toBe('SUSPENDED');
    });

    it('transitions ACTIVE → PAST_DUE on chargeFailure', () => {
      expect(sm.transition('ACTIVE', { type: 'chargeFailure' })).toBe('PAST_DUE');
    });

    it('transitions PAST_DUE → ACTIVE on chargeSuccess (recovery)', () => {
      expect(sm.transition('PAST_DUE', { type: 'chargeSuccess' })).toBe('ACTIVE');
    });

    it('transitions PAST_DUE → SUSPENDED on graceExpired', () => {
      expect(sm.transition('PAST_DUE', { type: 'graceExpired' })).toBe('SUSPENDED');
    });

    it('transitions SUSPENDED → ACTIVE on resumeSuccess', () => {
      expect(sm.transition('SUSPENDED', { type: 'resumeSuccess' })).toBe('ACTIVE');
    });

    it('ACTIVE → ACTIVE on upgrade / downgrade (self-loop)', () => {
      expect(sm.transition('ACTIVE', { type: 'upgrade' })).toBe('ACTIVE');
      expect(sm.transition('ACTIVE', { type: 'downgrade' })).toBe('ACTIVE');
    });
  });

  describe('cancel branch', () => {
    it.each(['TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED'] as const)(
      '%s → CANCELED on cancel',
      (from) => {
        expect(sm.transition(from, { type: 'cancel' })).toBe('CANCELED');
      },
    );
  });

  describe('terminal state', () => {
    it('CANCELED rejects every event', () => {
      const events: SubscriptionEvent['type'][] = [
        'chargeSuccess',
        'chargeFailure',
        'graceExpired',
        'resumeSuccess',
        'cancel',
        'upgrade',
        'downgrade',
        'trialExpired',
      ];
      for (const type of events) {
        expect(() =>
          sm.transition('CANCELED', { type } as SubscriptionEvent),
        ).toThrow(/Illegal subscription transition from CANCELED/);
      }
    });
  });

  describe('illegal transitions', () => {
    it('rejects ACTIVE → TRIALING (no startSubscription event on ACTIVE)', () => {
      expect(() =>
        sm.transition('ACTIVE', {
          type: 'trialExpired',
        }),
      ).toThrow(/Illegal subscription transition/);
    });

    it('rejects graceExpired from ACTIVE (only PAST_DUE can grace-expire)', () => {
      expect(() =>
        sm.transition('ACTIVE', { type: 'graceExpired' }),
      ).toThrow(/Illegal subscription transition from ACTIVE on graceExpired/);
    });

    it('rejects resumeSuccess from anywhere but SUSPENDED', () => {
      expect(() =>
        sm.transition('ACTIVE', { type: 'resumeSuccess' }),
      ).toThrow();
      expect(() =>
        sm.transition('PAST_DUE', { type: 'resumeSuccess' }),
      ).toThrow();
    });
  });

  describe('canTransition', () => {
    it('returns true for legal transitions', () => {
      expect(sm.canTransition('ACTIVE', 'cancel')).toBe(true);
      expect(sm.canTransition('PAST_DUE', 'chargeSuccess')).toBe(true);
    });

    it('returns false for illegal transitions without throwing', () => {
      expect(sm.canTransition('CANCELED', 'chargeSuccess')).toBe(false);
      expect(sm.canTransition('ACTIVE', 'graceExpired')).toBe(false);
    });
  });

  describe('transition table invariants', () => {
    it('CANCELED has no outgoing transitions', () => {
      expect(Object.keys(TRANSITIONS.CANCELED)).toHaveLength(0);
    });

    it('every non-terminal state allows cancel', () => {
      for (const from of ['TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED'] as const) {
        expect(TRANSITIONS[from].cancel).toBe('CANCELED');
      }
    });
  });
});
