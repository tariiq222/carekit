import { useQuery } from '@tanstack/react-query';

import { publicEmployeesService } from '@/services/client';

import { therapistKeys } from './useTherapists';

interface SlotsParams {
  employeeId?: string;
  date?: string;
  duration?: number;
  serviceId?: string;
  bookingType?: string;
}

interface SlotsResponse {
  slots: Array<{ startTime: string; endTime: string; available: boolean }>;
}

export function useSlots(params: SlotsParams) {
  const enabled = Boolean(params.employeeId && params.date);
  return useQuery<SlotsResponse>({
    queryKey: therapistKeys.slots(params as Record<string, unknown>),
    queryFn: () =>
      publicEmployeesService.getSlots({
        employeeId: params.employeeId as string,
        date: params.date as string,
        duration: params.duration,
        serviceId: params.serviceId,
        bookingType: params.bookingType,
      }),
    enabled,
  });
}
