import api from './api';
import type { ApiResponse } from '@/types/api';
import type { Specialty, Service } from '@/types/models';

export const specialtiesService = {
  async getAll() {
    const response = await api.get<ApiResponse<Specialty[]>>('/specialties');
    return response.data;
  },
};

export const servicesService = {
  async getAll() {
    const response = await api.get<ApiResponse<Service[]>>('/services');
    return response.data;
  },
};
