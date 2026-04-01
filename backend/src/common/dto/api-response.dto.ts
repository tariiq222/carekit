import {
  buildPaginationMeta,
  type PaginationMeta,
} from '../helpers/pagination.helper.js';

export class ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;

  constructor(data?: T, message?: string) {
    this.success = true;
    this.data = data;
    this.message = message;
  }
}

/**
 * Generic paginated response wrapper.
 * Uses the single PaginationMeta definition from pagination.helper.ts
 * to avoid duplicate type definitions.
 */
export class PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;

  constructor(items: T[], total: number, page: number, perPage: number) {
    this.items = items;
    this.meta = buildPaginationMeta(total, page, perPage);
  }
}
