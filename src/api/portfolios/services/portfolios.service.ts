import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  IPortfolioRepository,
  PORTFOLIO_REPOSITORY_TOKEN,
} from "../../../database/repositories/interfaces/portfolio-repository.interface";
import { Portfolio } from "../../../database/entities/portfolio.entity";

@Injectable()
export class PortfoliosService {
  constructor(
    @Inject(PORTFOLIO_REPOSITORY_TOKEN)
    private readonly portfolioRepository: IPortfolioRepository
  ) {}

  async getPortfolioByUserId(userId: string): Promise<Portfolio[]> {
    const portfolio = await this.portfolioRepository.findAllByUserId(userId);
    if (!portfolio.length) {
      throw new HttpException(
        `Portfolio(s) for user ${userId} not found`,
        HttpStatus.NOT_FOUND
      );
    }
    return portfolio;
  }
}
