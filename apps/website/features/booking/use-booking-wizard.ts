'use client';

import { useReducer } from 'react';
import {
  reduce,
  INITIAL_WIZARD_STATE,
  WizardStep,
  type WizardState,
} from '@carekit/shared';

export function useBookingWizard() {
  const [state, dispatch] = useReducer(reduce, INITIAL_WIZARD_STATE);

  return { state, dispatch };
}

export { WizardStep } from '@carekit/shared';
export type { WizardState, WizardEvent } from '@carekit/shared';