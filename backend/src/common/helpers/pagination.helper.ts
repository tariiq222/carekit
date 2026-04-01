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

export interface PaginationParams {
  page: number;
  perPage: number;
  skip: number;
}

/**
 * Parses and normalizes pagination input from query params.
 * Ensures safe defaults and bounds.
 */
export function parsePaginationParams(
  page?: number | string,
  perPage?: number | string,
  maxPerPage = 100,
): PaginationParams {
  const p = Math.max(
    1,
    typeof page === 'string' ? parseInt(page, 10) || 1 : page ?? 1,
  );
  const pp = Math.min(
    maxPerPage,
    Math.max(
      1,
      typeof perPage === 'string' ? parseInt(perPage, 10) || 20 : perPage ?? 20,
    ),
  );
  return { page: p, perPage: pp, skip: (p - 1) * pp };
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

/**
 * Generic paginated query helper for Prisma models.
 * Runs findMany + count in parallel for optimal performance.
 *
 * @example
 * const result = await paginatedQuery(prisma.user, { where: { isActive: true }, orderBy: { createdAt: 'desc' } }, page, perPage);
 * // result = { items: [...], meta: { total, page, perPage, totalPages, hasNextPage, hasPreviousPage } }
 */
export async function paginatedQuery<T>(
  model: { findMany: (args: any) => Promise<T[]>; count: (args: any) => Promise<number> },
  args: { where?: any; include?: any; orderBy?: any },
  page: number,
  perPage: number,
): Promise<{ items: T[]; meta: PaginationMeta }> {
  const skip = (page - 1) * perPage;
  const [items, total] = await Promise.all([
    model.findMany({ ...args, skip, take: perPage }),
    model.count({ where: args.where }),
  ]);
  return { items, meta: buildPaginationMeta(total, page, perPage) };
}
