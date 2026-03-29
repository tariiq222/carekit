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
      queryClient.invalidateQueries({ queryKey: BOOKING_SETTINGS_KEY })
    },
  })
}
