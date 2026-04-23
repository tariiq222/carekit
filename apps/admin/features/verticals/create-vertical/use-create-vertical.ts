import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createVertical } from './create-vertical.api';
import { verticalsListKey } from '../list-verticals/use-list-verticals';

export function useCreateVertical() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createVertical,
    onSuccess: () => {
      toast.success('Vertical created.');
      void qc.invalidateQueries({ queryKey: verticalsListKey });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create vertical');
    },
  });
}
