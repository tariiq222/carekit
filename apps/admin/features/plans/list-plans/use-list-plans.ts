import { useQuery } from '@tanstack/react-query';
import { listPlans } from './list-plans.api';

export const plansListKey = ['plans', 'list'] as const;

export function useListPlans() {
  return useQuery({ queryKey: plansListKey, queryFn: listPlans });
}
