import { adminRequest } from '@/lib/api-client';

export type DeliveryStatus = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
export type DeliveryChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP';
export type NotificationPriority = 'CRITICAL' | 'STANDARD';

export interface DeliveryLogItem {
  id: string;
  organizationId: string;
  recipientId: string;
  type: string;
  priority: NotificationPriority;
  channel: DeliveryChannel;
  status: DeliveryStatus;
  toAddress: string | null;
  providerName: string | null;
  attempts: number;
  lastAttemptAt: string | null;
  sentAt: string | null;
  errorMessage: string | null;
  jobId: string | null;
  createdAt: string;
}

export interface DeliveryLogResponse {
  items: DeliveryLogItem[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export type DeliveryLogFilters = {
  organizationId?: string;
  status?: string;
  channel?: string;
  page?: number;
  perPage?: number;
};

export function listDeliveryLog(filters: DeliveryLogFilters): Promise<DeliveryLogResponse> {
  const params = new URLSearchParams();

  if (filters.organizationId) {
    params.set('organizationId', filters.organizationId);
  }
  if (filters.status && filters.status !== 'all') {
    params.set('status', filters.status);
  }
  if (filters.channel && filters.channel !== 'all') {
    params.set('channel', filters.channel);
  }
  if (filters.page !== undefined) {
    params.set('page', String(filters.page));
  }
  if (filters.perPage !== undefined) {
    params.set('perPage', String(filters.perPage));
  }

  const query = params.toString();
  const url = query
    ? `/notifications/delivery-log?${query}`
    : '/notifications/delivery-log';

  return adminRequest<DeliveryLogResponse>(url);
}
