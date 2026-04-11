import api from './api';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type { Practitioner, Rating } from '@/types/models';

export type PractitionerAvailability = {
  dayOfWeek: number;
  isWorking: boolean;
  startTime: string;
  endTime: string;
};

interface GetPractitionersParams {
  specialtyId?: string;
  search?: string;
  sort?: 'rating' | 'name' | 'price';
  page?: number;
  limit?: number;
}

export const practitionersService = {
  async getAll(params?: GetPractitionersParams) {
    const response = await api.get<PaginatedResponse<Practitioner>>(
      '/practitioners',
      { params },
    );
    return response.data;
  },

  async getById(id: string) {
    const response = await api.get<ApiResponse<Practitioner>>(
      `/practitioners/${id}`,
    );
    return response.data;
  },

  async getAvailability(id: string, date: string, options?: { duration?: number; serviceId?: string; bookingType?: string }) {
    const response = await api.get<ApiResponse<{ slots: Array<{ startTime: string; endTime: string; available: boolean }> }>>(
      `/practitioners/${id}/slots`,
      {
        params: {
          date,
          ...(options?.duration && { duration: options.duration }),
          ...(options?.serviceId && { serviceId: options.serviceId }),
          ...(options?.bookingType && { bookingType: options.bookingType }),
        },
      },
    );
    return response.data;
  },

  async getRatings(id: string, page = 1, limit = 10) {
    const response = await api.get<PaginatedResponse<Rating>>(
      `/practitioners/${id}/ratings`,
      { params: { page, limit } },
    );
    return response.data;
  },

  async getFeatured() {
    const response = await api.get<ApiResponse<Practitioner[]>>(
      '/practitioners',
      { params: { sort: 'rating', limit: 5 } },
    );
    return response.data;
  },

  async getAvailabilitySchedule(id: string) {
    const response = await api.get<ApiResponse<PractitionerAvailability[]>>(
      `/practitioners/${id}/availability`,
    );
    return response.data;
  },

  async updateAvailabilitySchedule(id: string, schedule: PractitionerAvailability[]) {
    const response = await api.put<ApiResponse<PractitionerAvailability[]>>(
      `/practitioners/${id}/availability`,
      { schedule },
    );
    return response.data;
  },
};
