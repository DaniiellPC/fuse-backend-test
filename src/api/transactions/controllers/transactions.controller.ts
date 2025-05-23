import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { BuyStockRequestDTO } from "./dtos/BuyStockRequestDTO";
import { TransactionsService } from "../services/transactions.service";

@Controller("/transactions")
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post("/buy")
  async BuyStock(@Body() body: BuyStockRequestDTO): Promise<any> {
    const response = await this.transactionsService.buyStock(body);

    return response;
  }
}
