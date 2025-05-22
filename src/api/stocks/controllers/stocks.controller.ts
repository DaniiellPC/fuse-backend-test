import { Controller, Get, Query } from "@nestjs/common";
import { ListStocksDTO } from "./dtos/ListStocksDTO";
import { StocksService } from "../services/stocks.service";

@Controller()
export class StocksController {
  constructor(private readonly stocksService: StocksService) {}

  @Get("/stocks")
  async ListStocks(@Query() query: ListStocksDTO): Promise<any> {
    const nextToken = query.nextToken;
    const stocks = await this.stocksService.execute(nextToken);

    return stocks;
  }
}
