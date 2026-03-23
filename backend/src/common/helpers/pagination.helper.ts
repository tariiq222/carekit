export interface PaginationMeta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export function buildPaginationMeta(
  total: number,
  page: number,
  perPage: number,
): PaginationMeta {
  const totalPages = Math.ceil(total / perPage);
  return {
    total,
    page,
    perPage,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  perPage: number,
): PaginatedResult<T> {
  return { data, meta: buildPaginationMeta(total, page, perPage) };
}
