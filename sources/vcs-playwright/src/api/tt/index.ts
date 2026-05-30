export interface IdDto {
  id: string;
}

export interface PagedDtoList<T> {
  pageNumber: number;
  pageSize: number;
  hasNext: boolean;
  content: T[];
  totalElements: number;
}
