import api from './api';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type { Booking, BookingStatus, BookingType } from '@/types/models';

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

export const bookingsService = {
  async getAll(params?: GetBookingsParams) {
    const response = await api.get<PaginatedResponse<Booking>>('/bookings', {
      params,
    });
    return response.data;
  },

  async getById(id: string) {
    const response = await api.get<ApiResponse<Booking>>(`/bookings/${id}`);
    return response.data;
  },

  async create(data: CreateBookingData) {
    const response = await api.post<ApiResponse<Booking>>('/bookings', data);
    return response.data;
  },

  async requestCancellation(id: string, reason: string) {
    const response = await api.post<ApiResponse<Booking>>(
      `/bookings/${id}/cancel-request`,
      { reason },
    );
    return response.data;
  },

  async markCompleted(id: string) {
    const response = await api.post<ApiResponse<Booking>>(
      `/bookings/${id}/complete`,
    );
    return response.data;
  },

  async getUpcoming() {
    const response = await api.get<ApiResponse<Booking[]>>('/bookings', {
      params: { status: ['pending', 'confirmed'], limit: 1 },
    });
    return response.data;
  },

  async startSession(id: string) {
    const response = await api.post<ApiResponse<Booking>>(
      `/bookings/${id}/start`,
    );
    return response.data;
  },

  async employeeCancel(id: string, reason?: string) {
    const response = await api.post<ApiResponse<Booking>>(
      `/bookings/${id}/employee-cancel`,
      { reason },
    );
    return response.data;
  },

  async getTodayBookings() {
    const response = await api.get<ApiResponse<{ items: Booking[]; meta: unknown }>>(
      '/bookings/today',
    );
    return response.data;
  },
};
