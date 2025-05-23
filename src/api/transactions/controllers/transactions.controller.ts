import { Body, Controller, Post } from "@nestjs/common";
import { BuyStockRequestDTO } from "./dtos/BuyStockRequestDTO";
import { TransactionsService } from "../services/transactions.service";
import { Transaction } from "../../../database/entities/transaction.entity";

@Controller("/transactions")
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post("/buy")
  async BuyStock(@Body() body: BuyStockRequestDTO): Promise<Transaction> {
    const response = await this.transactionsService.buyStock(body);

    return response;
  }
}
