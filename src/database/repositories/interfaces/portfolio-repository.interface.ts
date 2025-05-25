import { Portfolio } from "../../entities/portfolio.entity";
import { EntityManager } from "typeorm";

export const PORTFOLIO_REPOSITORY_TOKEN = "IPortfolioRepository";

export interface IPortfolioRepository {
  findOneByUserId(
    userId: string,
    manager?: EntityManager
  ): Promise<Portfolio | null>;
  findAllByUserId(
    userId: string,
    manager?: EntityManager
  ): Promise<Portfolio[]>;
  findOneByUserIdAndSymbol(
    userId: string,
    stockSymbol: string,
    manager?: EntityManager
  ): Promise<Portfolio | null>;
  save(portfolio: Portfolio, manager?: EntityManager): Promise<Portfolio>;
  create(portfolioData: Partial<Portfolio>, manager?: EntityManager): Portfolio;
}
