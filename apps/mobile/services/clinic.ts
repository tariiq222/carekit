import api from './api';
import type { ApiResponse } from '@/types/api';

export interface ClinicSettings {
  bankName: string | null;
  bankIban: string | null;
  accountHolder: string | null;
}

export const clinicService = {
  async getSettings(): Promise<ApiResponse<ClinicSettings>> {
    const response = await api.get<ApiResponse<ClinicSettings>>(
      '/clinic/settings/public',
    );
    return response.data;
  },
};
