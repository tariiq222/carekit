import { useQuery } from '@tanstack/react-query';
import { listVerticals } from './list-verticals.api';

export const verticalsListKey = ['verticals', 'list'] as const;

export function useListVerticals() {
  return useQuery({ queryKey: verticalsListKey, queryFn: listVerticals });
}
