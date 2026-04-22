import { adminRequest } from '@/lib/api-client';
import type { VerticalRow } from '../types';

export function listVerticals(): Promise<VerticalRow[]> {
  return adminRequest<VerticalRow[]>('/verticals');
}
