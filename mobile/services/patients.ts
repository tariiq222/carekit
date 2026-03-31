import api from './api';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type { Booking } from '@/types/models';

export interface PatientRecord {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string;
  avatarUrl: string | null;
}

export const patientsService = {
  async getById(id: string) {
    const response = await api.get<ApiResponse<PatientRecord>>(`/patients/${id}`);
    return response.data;
  },

  async getPractitionerBookings(patientId: string) {
    const response = await api.get<PaginatedResponse<Booking>>('/bookings', {
      params: { patientId, limit: 50 },
    });
    return response.data;
  },
};
