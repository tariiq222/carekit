import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { refundInvoice } from './refund-invoice.api';

export function useRefundInvoice(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: refundInvoice,
    onSuccess: () => {
      toast.success('Refund processed via Moyasar.');
      void qc.invalidateQueries({ queryKey: ['billing', 'org', orgId] });
      void qc.invalidateQueries({ queryKey: ['billing', 'invoices'] });
      void qc.invalidateQueries({ queryKey: ['billing', 'metrics'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Refund failed');
    },
  });
}
