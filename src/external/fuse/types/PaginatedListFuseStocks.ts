import { FuseStocksDataItem } from "./GetFuseStocksResponse";

export type PaginatedListFuseStocks = {
  items: FuseStocksDataItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
