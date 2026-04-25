import api from '../api';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type { Booking, BookingStatus, BookingType } from '@/types/models';

// Employee-side booking calls. All endpoints live under `/mobile/employee/bookings/...`
// (see apps/backend/src/api/mobile/employee/bookings.controller.ts) and enforce
// ownership: the authenticated employee can only act on bookings assigned to them.

interface CreateBookingData {
  employeeId: string;
  type: BookingType;
  date: string;
  startTime: string;
  notes?: string;
}

interface GetBookingsParams {
  status?: BookingStatus | BookingStatus[];
  date?: string;
  page?: number;
  limit?: number;
}

export const employeeBookingsService = {
  async getAll(params?: GetBookingsParams) {
    const response = await api.get<PaginatedResponse<Booking>>('/mobile/employee/bookings', { params });
    return response.data;
  },

  async getById(id: string) {
    const response = await api.get<ApiResponse<Booking>>(`/mobile/employee/bookings/${id}`);
    return response.data;
  },

  async create(data: CreateBookingData) {
    // Employee-initiated booking creation still goes through the dashboard endpoint.
    // The mobile app does not expose this flow today; left here for parity with older
    // call sites until the Employee app gets its own create-booking screen.
    const response = await api.post<ApiResponse<Booking>>('/dashboard/bookings', data);
    return response.data;
  },

  async requestCancellation(id: string, reason: string) {
    const response = await api.post<ApiResponse<Booking>>(
      `/mobile/employee/bookings/${id}/cancel-request`,
      { cancelNotes: reason },
    );
    return response.data;
  },

  async markCompleted(id: string) {
    const response = await api.post<ApiResponse<Booking>>(
      `/mobile/employee/bookings/${id}/complete`,
    );
    return response.data;
  },

  async getUpcoming() {
    const response = await api.get<ApiResponse<{ items: Booking[]; meta: unknown }>>(
      '/mobile/employee/bookings',
      { params: { status: ['pending', 'confirmed'], limit: 1 } },
    );
    return response.data;
  },

  async startSession(id: string) {
    const response = await api.post<ApiResponse<Booking>>(
      `/mobile/employee/bookings/${id}/start`,
    );
    return response.data;
  },

  async employeeCancel(id: string, reason?: string) {
    const response = await api.post<ApiResponse<Booking>>(
      `/mobile/employee/bookings/${id}/employee-cancel`,
      { cancelNotes: reason },
    );
    return response.data;
  },

  async getTodayBookings() {
    const response = await api.get<ApiResponse<{ items: Booking[]; meta: unknown }>>(
      '/mobile/employee/schedule/today',
    );
    return response.data;
  },
};
