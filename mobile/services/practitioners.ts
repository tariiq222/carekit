import api from './api';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type { Practitioner, Rating } from '@/types/models';

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

  async getAvailability(id: string, date: string) {
    const response = await api.get<ApiResponse<{ slots: string[] }>>(
      `/practitioners/${id}/availability`,
      { params: { date } },
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
};
