import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
} from "@nestjs/common";
import { PortfoliosService } from "../services/portfolios.service";
import { FindPortfolioByUserIdResponseDTO } from "./dtos/FindPortfolioByUserIdResponseDTO";

@Controller("/portfolios")
export class PortfoliosController {
  constructor(private readonly portfoliosService: PortfoliosService) {}

  @Get("/:userId/portfolio")
  async FindPortfolioByUserId(
    @Param("userId") userId: string
  ): Promise<FindPortfolioByUserIdResponseDTO> {
    this.portfoliosService.validateUserId(userId);

    const portfolio = await this.portfoliosService.getPortfolioByUserId(userId);

    return FindPortfolioByUserIdResponseDTO.fromDomain(portfolio);
  }
}
