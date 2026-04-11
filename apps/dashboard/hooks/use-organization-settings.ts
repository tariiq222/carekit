"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  fetchOrganizationHours,
  updateOrganizationHours,
  fetchOrganizationHolidays,
  createOrganizationHoliday,
  deleteOrganizationHoliday,
} from "@/lib/api/organization"
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
} from "@/lib/api/organization-settings"
import { fetchOrganizationSettings, updateOrganizationSettings } from "@/lib/api/organization-settings"
import type { UpdateOrganizationSettingsPayload } from "@/lib/types/organization-settings"
import { queryKeys } from "@/lib/query-keys"

/* ─── Query Keys ─── */

const ORGANIZATION_HOURS_KEY = ["organization-hours"] as const
const ORGANIZATION_HOLIDAYS_KEY = ["organization-holidays"] as const
const BOOKING_SETTINGS_KEY = ["booking-settings"] as const

/* ─── Clinic Working Hours ─── */

export function useOrganizationHours() {
  return useQuery({
    queryKey: ORGANIZATION_HOURS_KEY,
    queryFn: fetchOrganizationHours,
    staleTime: 30 * 60 * 1000, // 30 min — hours rarely change
  })
}

export function useOrganizationHoursMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateOrganizationHours,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORGANIZATION_HOURS_KEY })
    },
  })
}

/* ─── Clinic Holidays ─── */

export function useOrganizationHolidays() {
  return useQuery({
    queryKey: ORGANIZATION_HOLIDAYS_KEY,
    queryFn: () => fetchOrganizationHolidays(),
    staleTime: 30 * 60 * 1000, // 30 min — holidays are planned in advance
  })
}

export function useCreateHoliday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createOrganizationHoliday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORGANIZATION_HOLIDAYS_KEY })
    },
  })
}

export function useDeleteHoliday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteOrganizationHoliday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORGANIZATION_HOLIDAYS_KEY })
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
      queryClient.invalidateQueries({ queryKey: queryKeys.organizationPublic.settings() })
    },
  })
}

/* ─── Booking Flow Order ─── */

export function useBookingFlowOrder() {
  return useQuery({
    queryKey: queryKeys.organizationSettings.bookingFlowOrder(),
    queryFn: fetchBookingFlowOrder,
    staleTime: 5 * 60 * 1000,
  })
}

export function useBookingFlowOrderMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (order: BookingFlowOrder) => updateBookingFlowOrder(order),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizationSettings.bookingFlowOrder() })
    },
  })
}

/* ─── Payment Settings ─── */

export function usePaymentSettings() {
  return useQuery({
    queryKey: queryKeys.organizationSettings.payment(),
    queryFn: fetchPaymentSettings,
    staleTime: 5 * 60 * 1000,
  })
}

export function usePaymentSettingsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updatePaymentSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizationSettings.payment() })
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
    queryKey: ["organization-settings", "widget"],
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
      queryClient.invalidateQueries({ queryKey: queryKeys.organizationPublic.settings() })
    },
  })
}

/* ─── Clinic Settings Config ─── */

export function useOrganizationSettings() {
  return useQuery({
    queryKey: queryKeys.organizationSettings.config(),
    queryFn: fetchOrganizationSettings,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateOrganizationSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateOrganizationSettingsPayload) => updateOrganizationSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizationSettings.all })
    },
  })
}
