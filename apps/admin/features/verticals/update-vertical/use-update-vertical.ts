import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { updateVertical } from './update-vertical.api';
import { verticalsListKey } from '../list-verticals/use-list-verticals';

export function useUpdateVertical() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateVertical,
    onSuccess: () => {
      toast.success('Vertical updated.');
      void qc.invalidateQueries({ queryKey: verticalsListKey });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update vertical');
    },
  });
}
