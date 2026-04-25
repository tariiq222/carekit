import api from '../api';
import type { Payment } from '@/types/models';

export interface PaymentsListResponse {
  items: Payment[];
  meta: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export const clientPaymentsService = {
  async list(params?: { page?: number; limit?: number }) {
    const response = await api.get<PaymentsListResponse>(
      '/mobile/client/payments',
      { params },
    );
    return response.data;
  },

  async getInvoice(id: string) {
    const response = await api.get(`/mobile/client/payments/${id}`);
    return response.data;
  },

  async uploadBankTransfer(invoiceId: string, amount: number, imageUri: string) {
    const formData = new FormData();
    formData.append('invoiceId', invoiceId);
    formData.append('amount', String(amount));
    formData.append('receipt', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'receipt.jpg',
    } as unknown as Blob);

    const response = await api.post(
      '/mobile/client/payments/bank-transfer',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  },
};
