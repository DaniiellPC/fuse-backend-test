import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import {
  IPortfolioRepository,
  PORTFOLIO_REPOSITORY_TOKEN,
} from "../../../database/repositories/interfaces/portfolio-repository.interface";
import { Portfolio } from "../../../database/entities/portfolio.entity";
import { version as uuidVersion, validate as uuidValidate } from "uuid";
import { EntityManager } from "typeorm";

@Injectable()
export class PortfoliosService {
  private readonly logger = new Logger(PortfoliosService.name);
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

  async upsertPortfolio(
    userId: string,
    stockSymbol: string,
    quantity: number,
    clientPrice: number,
    totalCost: number,
    manager: EntityManager
  ): Promise<void> {
    let portfolioItem = await this.portfolioRepository.findOneByUserIdAndSymbol(
      userId,
      stockSymbol,
      manager
    );

    if (portfolioItem) {
      const currentTotalValue =
        portfolioItem.getQuantity() * portfolioItem.getAverageBuyPrice();
      const newTotalValue = currentTotalValue + totalCost;
      const newQuantity = portfolioItem.quantity + quantity;

      portfolioItem.setQuantity(newQuantity);
      portfolioItem.setAverageBuyPrice(
        parseFloat((newTotalValue / newQuantity).toFixed(4))
      );

      this.logger.log(
        `Portfolio updated for user ${userId}, stock ${stockSymbol}. New quantity: ${portfolioItem.getQuantity()}, Average price: ${portfolioItem.getAverageBuyPrice()}`
      );
    } else {
      portfolioItem = this.portfolioRepository.create(
        {
          user_id: userId,
          stock_symbol: stockSymbol,
          quantity: quantity,
          average_buy_price: clientPrice,
        },
        manager
      );
      this.logger.log(
        `New portfolio entry created for user ${userId}, stock ${stockSymbol}. Quantity: ${portfolioItem.getQuantity()}`
      );
    }
    await this.portfolioRepository.save(portfolioItem, manager);
  }

  validateUserId(userId: string): void {
    if (!userId) {
      throw new HttpException("User ID is required", HttpStatus.BAD_REQUEST);
    }

    if (!this.uuidValidateV4(userId)) {
      throw new HttpException(
        `User ID ${userId} is not a valid UUIDv4`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private uuidValidateV4(uuid: string): boolean {
    return uuidValidate(uuid) && uuidVersion(uuid) === 4;
  }
}
