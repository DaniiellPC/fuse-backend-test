import { Controller, Get, Query, Logger } from "@nestjs/common";
import { ListStocksRequestDTO } from "./dtos/ListStocksRequestDTO";
import { StocksService } from "../services/stocks.service";
import { ListStocksResponseDTO } from "./dtos/ListStocksResponseDTO";

@Controller("/stocks")
export class StocksController {
  private readonly logger = new Logger(StocksController.name);

  constructor(private readonly stocksService: StocksService) {}

  @Get()
  async ListStocks(
    @Query() query: ListStocksRequestDTO
  ): Promise<ListStocksResponseDTO> {
    this.logger.log(
      `[StocksController] Received query object: ${JSON.stringify(query)}`
    );
    const { page, limit } = query;
    const stocks = await this.stocksService.listStocks(page, limit);

    return ListStocksResponseDTO.fromDomain(stocks);
  }
}
