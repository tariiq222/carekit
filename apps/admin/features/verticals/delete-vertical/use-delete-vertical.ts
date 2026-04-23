import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { deleteVertical } from './delete-vertical.api';
import { verticalsListKey } from '../list-verticals/use-list-verticals';

export function useDeleteVertical() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteVertical,
    onSuccess: () => {
      toast.success('Vertical deleted.');
      void qc.invalidateQueries({ queryKey: verticalsListKey });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete vertical');
    },
  });
}
