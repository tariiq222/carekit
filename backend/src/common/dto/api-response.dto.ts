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

export class PaginationMeta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;

  constructor(total: number, page: number, perPage: number) {
    this.total = total;
    this.page = page;
    this.perPage = perPage;
    this.totalPages = Math.ceil(total / perPage);
    this.hasNextPage = page < this.totalPages;
    this.hasPreviousPage = page > 1;
  }
}

export class PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;

  constructor(items: T[], total: number, page: number, perPage: number) {
    this.items = items;
    this.meta = new PaginationMeta(total, page, perPage);
  }
}
