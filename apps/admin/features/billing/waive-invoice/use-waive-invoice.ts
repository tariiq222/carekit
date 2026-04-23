import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { waiveInvoice } from './waive-invoice.api';

export function useWaiveInvoice(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: waiveInvoice,
    onSuccess: () => {
      toast.success('Invoice waived.');
      void qc.invalidateQueries({ queryKey: ['billing', 'org', orgId] });
      void qc.invalidateQueries({ queryKey: ['billing', 'invoices'] });
      void qc.invalidateQueries({ queryKey: ['billing', 'metrics'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to waive invoice');
    },
  });
}
