/**
 * Builds a Prisma-compatible date range filter object.
 * Returns undefined if neither bound is provided.
 */
export function buildDateRangeFilter(
  dateFrom?: string,
  dateTo?: string,
): { gte?: Date; lte?: Date } | undefined {
  if (!dateFrom && !dateTo) return undefined;

  const filter: { gte?: Date; lte?: Date } = {};
  if (dateFrom) filter.gte = new Date(dateFrom);
  if (dateTo) filter.lte = new Date(dateTo);
  return filter;
}
