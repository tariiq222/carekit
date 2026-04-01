import { useCallback, useState } from 'react'
import type { BookingFlowOrder } from '@/lib/api/clinic-settings'

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6

export interface WizardState {
  step: WizardStep
  patientId: string | null
  patientName: string | null
  serviceId: string | null
  serviceName: string | null
  practitionerId: string | null
  practitionerName: string | null
  type: 'in_person' | 'online' | 'walk_in' | null
  durationOptionId: string | null
  durationLabel: string | null
  date: string | null        // ISO date YYYY-MM-DD
  startTime: string | null   // HH:MM
  payAtClinic: boolean
}

const INITIAL_STATE: WizardState = {
  step: 1,
  patientId: null,
  patientName: null,
  serviceId: null,
  serviceName: null,
  practitionerId: null,
  practitionerName: null,
  type: null,
  durationOptionId: null,
  durationLabel: null,
  date: null,
  startTime: null,
  payAtClinic: false,
}

export function useWizardState(flowOrder: BookingFlowOrder = 'service_first') {
  const [state, setState] = useState<WizardState>(INITIAL_STATE)

  // Step 2 is service or practitioner depending on flowOrder
  const stepForService: WizardStep = flowOrder === 'service_first' ? 2 : 3
  const stepForPractitioner: WizardStep = flowOrder === 'service_first' ? 3 : 2

  const reset = useCallback(() => setState(INITIAL_STATE), [])

  const goToStep = useCallback((step: WizardStep) => {
    setState((prev) => ({ ...prev, step }))
  }, [])

  const selectPatient = useCallback(
    (patientId: string, patientName: string) => {
      setState((prev) => ({
        ...prev,
        patientId,
        patientName,
        serviceId: null,
        serviceName: null,
        practitionerId: null,
        practitionerName: null,
        type: null,
        durationOptionId: null,
        durationLabel: null,
        date: null,
        startTime: null,
        step: 2,
      }))
    },
    [],
  )

  const selectService = useCallback(
    (serviceId: string, serviceName: string) => {
      setState((prev) => ({
        ...prev,
        serviceId,
        serviceName,
        practitionerId: null,
        practitionerName: null,
        type: null,
        durationOptionId: null,
        durationLabel: null,
        date: null,
        startTime: null,
        step: (prev.step + 1) as WizardStep,
      }))
    },
    [],
  )

  const selectPractitioner = useCallback(
    (practitionerId: string, practitionerName: string) => {
      setState((prev) => ({
        ...prev,
        practitionerId,
        practitionerName,
        type: null,
        durationOptionId: null,
        durationLabel: null,
        date: null,
        startTime: null,
        step: (prev.step + 1) as WizardStep,
      }))
    },
    [],
  )

  const selectType = useCallback(
    (type: 'in_person' | 'online' | 'walk_in') => {
      setState((prev) => ({
        ...prev,
        type,
        durationOptionId: null,
        durationLabel: null,
        date: null,
        startTime: null,
      }))
    },
    [],
  )

  const selectDuration = useCallback(
    (durationOptionId: string, durationLabel: string) => {
      setState((prev) => ({
        ...prev,
        durationOptionId,
        durationLabel,
        date: null,
        startTime: null,
        step: 5,
      }))
    },
    [],
  )

  const skipDuration = useCallback(() => {
    setState((prev) => ({
      ...prev,
      durationOptionId: null,
      durationLabel: null,
      step: 5,
    }))
  }, [])

  const selectDate = useCallback((date: string) => {
    setState((prev) => ({
      ...prev,
      date,
      startTime: null,
    }))
  }, [])

  const selectTime = useCallback((startTime: string) => {
    setState((prev) => ({ ...prev, startTime, step: 6 }))
  }, [])

  const setPayAtClinic = useCallback((payAtClinic: boolean) => {
    setState((prev) => ({ ...prev, payAtClinic }))
  }, [])

  const goBack = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: Math.max(1, prev.step - 1) as WizardStep,
    }))
  }, [])

  const jumpToStep = useCallback(
    (targetStep: WizardStep) => {
      setState((prev) => {
        const next = { ...prev, step: targetStep }
        if (targetStep <= stepForService) {
          next.serviceId = null
          next.serviceName = null
          next.practitionerId = null
          next.practitionerName = null
          next.type = null
          next.durationOptionId = null
          next.durationLabel = null
          next.date = null
          next.startTime = null
        } else if (targetStep <= stepForPractitioner) {
          next.practitionerId = null
          next.practitionerName = null
          next.type = null
          next.durationOptionId = null
          next.durationLabel = null
          next.date = null
          next.startTime = null
        } else if (targetStep === 4) {
          next.type = null
          next.durationOptionId = null
          next.durationLabel = null
          next.date = null
          next.startTime = null
        } else if (targetStep === 5) {
          next.date = null
          next.startTime = null
        }
        return next
      })
    },
    [stepForService, stepForPractitioner],
  )

  return {
    state,
    stepForService,
    stepForPractitioner,
    reset,
    goToStep,
    goBack,
    jumpToStep,
    selectPatient,
    selectService,
    selectPractitioner,
    selectType,
    selectDuration,
    skipDuration,
    selectDate,
    selectTime,
    setPayAtClinic,
  }
}
