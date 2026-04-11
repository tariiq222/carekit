"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  fetchClinicHours,
  updateClinicHours,
  fetchClinicHolidays,
  createClinicHoliday,
  deleteClinicHoliday,
} from "@/lib/api/clinic"
import {
  fetchBookingSettings,
  updateBookingSettings,
} from "@/lib/api/booking-settings"
import {
  fetchBookingFlowOrder,
  updateBookingFlowOrder,
  fetchPaymentSettings,
  updatePaymentSettings,
  type BookingFlowOrder,
} from "@/lib/api/clinic-settings"
import { fetchClinicSettings, updateClinicSettings } from "@/lib/api/clinic-settings"
import type { UpdateClinicSettingsPayload } from "@/lib/types/clinic-settings"
import { queryKeys } from "@/lib/query-keys"

/* ─── Query Keys ─── */

const CLINIC_HOURS_KEY = ["clinic-hours"] as const
const CLINIC_HOLIDAYS_KEY = ["clinic-holidays"] as const
const BOOKING_SETTINGS_KEY = ["booking-settings"] as const

/* ─── Clinic Working Hours ─── */

export function useClinicHours() {
  return useQuery({
    queryKey: CLINIC_HOURS_KEY,
    queryFn: fetchClinicHours,
    staleTime: 30 * 60 * 1000, // 30 min — hours rarely change
  })
}

export function useClinicHoursMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateClinicHours,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLINIC_HOURS_KEY })
    },
  })
}

/* ─── Clinic Holidays ─── */

export function useClinicHolidays() {
  return useQuery({
    queryKey: CLINIC_HOLIDAYS_KEY,
    queryFn: () => fetchClinicHolidays(),
    staleTime: 30 * 60 * 1000, // 30 min — holidays are planned in advance
  })
}

export function useCreateHoliday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createClinicHoliday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLINIC_HOLIDAYS_KEY })
    },
  })
}

export function useDeleteHoliday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteClinicHoliday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLINIC_HOLIDAYS_KEY })
    },
  })
}

/* ─── Booking Settings ─── */

export function useBookingSettings() {
  return useQuery({
    queryKey: BOOKING_SETTINGS_KEY,
    queryFn: fetchBookingSettings,
    staleTime: 30 * 60 * 1000, // 30 min — booking config rarely changes
  })
}

export function useBookingSettingsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateBookingSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookingSettings.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.widget.branding() })
      queryClient.invalidateQueries({ queryKey: queryKeys.widget.settings() })
      queryClient.invalidateQueries({ queryKey: queryKeys.clinicPublic.settings() })
    },
  })
}

/* ─── Booking Flow Order ─── */

export function useBookingFlowOrder() {
  return useQuery({
    queryKey: queryKeys.clinicSettings.bookingFlowOrder(),
    queryFn: fetchBookingFlowOrder,
    staleTime: 5 * 60 * 1000,
  })
}

export function useBookingFlowOrderMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (order: BookingFlowOrder) => updateBookingFlowOrder(order),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clinicSettings.bookingFlowOrder() })
    },
  })
}

/* ─── Payment Settings ─── */

export function usePaymentSettings() {
  return useQuery({
    queryKey: queryKeys.clinicSettings.payment(),
    queryFn: fetchPaymentSettings,
    staleTime: 5 * 60 * 1000,
  })
}

export function usePaymentSettingsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updatePaymentSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clinicSettings.payment() })
    },
  })
}

/* ─── Widget Settings ─── */

export interface WidgetSettings {
  widgetShowPrice: boolean
  widgetAnyEmployee: boolean
  widgetRedirectUrl: string | null
}

export function useWidgetSettings() {
  return useQuery({
    queryKey: ["clinic-settings", "widget"],
    queryFn: () => fetchBookingSettings().then((s) => ({
      widgetShowPrice:          s.widgetShowPrice ?? true,
      widgetAnyEmployee:    s.widgetAnyEmployee ?? false,
      widgetRedirectUrl:        s.widgetRedirectUrl ?? null,
    })),
    staleTime: 5 * 60 * 1000,
  })
}

export function useWidgetSettingsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<WidgetSettings>) => updateBookingSettings({ ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOOKING_SETTINGS_KEY })
      queryClient.invalidateQueries({ queryKey: queryKeys.widget.branding() })
      queryClient.invalidateQueries({ queryKey: queryKeys.widget.settings() })
      queryClient.invalidateQueries({ queryKey: queryKeys.clinicPublic.settings() })
    },
  })
}

/* ─── Clinic Settings Config ─── */

export function useClinicSettings() {
  return useQuery({
    queryKey: queryKeys.clinicSettings.config(),
    queryFn: fetchClinicSettings,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateClinicSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateClinicSettingsPayload) => updateClinicSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clinicSettings.all })
    },
  })
}
