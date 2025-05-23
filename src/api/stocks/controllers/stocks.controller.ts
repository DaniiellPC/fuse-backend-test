import { Controller, Get, Query } from "@nestjs/common";
import { ListStocksRequestDTO } from "./dtos/ListStocksRequestDTO";
import { StocksService } from "../services/stocks.service";
import { ListStocksResponseDTO } from "./dtos/ListStocksResponseDTO";

@Controller("/stocks")
export class StocksController {
  constructor(private readonly stocksService: StocksService) {}

  @Get()
  async ListStocks(
    @Query() query: ListStocksRequestDTO
  ): Promise<ListStocksResponseDTO> {
    let page = Number(query.page ?? 1);
    let limit = Number(query.limit ?? 10);

    const stocks = await this.stocksService.listStocks(page, limit);

    return ListStocksResponseDTO.fromDomain(stocks);
  }
}
