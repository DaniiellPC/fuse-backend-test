import { Body, Controller, Post } from "@nestjs/common";
import { BuyStockRequestDTO } from "./dtos/BuyStockRequestDTO";
import { TransactionsService } from "../services/transactions.service";
import { BuyStockResponseDTO } from "./dtos/BuyStockResponseDTO";
import { Throttle } from "@nestjs/throttler";

@Controller("/transactions")
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Throttle({ default: { limit: 3, ttl: 50000 } })
  @Post("/buy")
  async BuyStock(
    @Body() body: BuyStockRequestDTO
  ): Promise<BuyStockResponseDTO> {
    const response = await this.transactionsService.buyStock(body);

    return BuyStockResponseDTO.fromDomain(response);
  }
}
