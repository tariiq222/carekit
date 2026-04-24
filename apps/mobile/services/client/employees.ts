import api from '../api';

export interface PublicEmployeeItem {
  id: string;
  slug: string | null;
  nameAr: string | null;
  nameEn: string | null;
  title: string | null;
  specialty: string | null;
  specialtyAr: string | null;
  publicBioAr: string | null;
  publicBioEn: string | null;
  publicImageUrl: string | null;
}

export const publicEmployeesService = {
  async list() {
    const response = await api.get<PublicEmployeeItem[]>('/public/employees');
    return response.data;
  },

  async getByKey(key: string) {
    const response = await api.get<PublicEmployeeItem>(`/public/employees/${key}`);
    return response.data;
  },

  async getSlots(params: {
    employeeId: string;
    date: string;
    duration?: number;
    serviceId?: string;
    bookingType?: string;
  }) {
    const response = await api.get<{
      slots: Array<{ startTime: string; endTime: string; available: boolean }>;
    }>('/public/slots', { params });
    return response.data;
  },
};
