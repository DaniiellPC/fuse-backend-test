import { PaginatedListFuseStocks } from "../../../../external/fuse/types/PaginatedListFuseStocks";
import { StocksItemsDTO } from "./StocksItemsDTO";

export class ListStocksResponseDTO {
  public readonly items: StocksItemsDTO[];
  public readonly totalItems: number;
  public readonly page: number;
  public readonly limit: number;
  public readonly totalPages: number;

  static fromDomain(
    paginatedFuseStocks: PaginatedListFuseStocks
  ): ListStocksResponseDTO {
    return {
      items: paginatedFuseStocks.items.map(StocksItemsDTO.fromDomain),
      totalItems: paginatedFuseStocks.total,
      page: paginatedFuseStocks.page,
      limit: paginatedFuseStocks.limit,
      totalPages: paginatedFuseStocks.totalPages,
    };
  }
}
