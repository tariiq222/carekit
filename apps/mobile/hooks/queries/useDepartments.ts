import { useQuery } from '@tanstack/react-query';

import {
  publicCatalogService,
  type PublicCatalogDepartment,
} from '@/services/client/catalog';

export const departmentKeys = {
  all: ['departments'] as const,
  lists: () => [...departmentKeys.all, 'list'] as const,
};

export function useDepartments() {
  return useQuery<PublicCatalogDepartment[]>({
    queryKey: departmentKeys.lists(),
    queryFn: () => publicCatalogService.listDepartments(),
  });
}
