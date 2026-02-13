export interface PaginationMeta {
  has_more: boolean;
  next_cursor: string | null;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}
