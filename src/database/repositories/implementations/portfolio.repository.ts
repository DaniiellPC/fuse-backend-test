import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager, Repository } from "typeorm";
import { Portfolio } from "../../entities/portfolio.entity";
import { IPortfolioRepository } from "../interfaces/portfolio-repository.interface";

@Injectable()
export class PortfolioRepository implements IPortfolioRepository {
  private readonly portfolioRepo: Repository<Portfolio>;

  constructor(private readonly dataSource: DataSource) {
    this.portfolioRepo = this.dataSource.getRepository(Portfolio);
  }

  async findOneByUserIdAndSymbol(
    userId: string,
    stockSymbol: string,
    manager?: EntityManager
  ): Promise<Portfolio | null> {
    const repository = manager
      ? manager.getRepository(Portfolio)
      : this.portfolioRepo;
    return repository.findOne({
      where: { user_id: userId, stock_symbol: stockSymbol },
    });
  }

  async save(
    portfolio: Portfolio,
    manager?: EntityManager
  ): Promise<Portfolio> {
    const repository = manager
      ? manager.getRepository(Portfolio)
      : this.portfolioRepo;
    return repository.save(portfolio);
  }

  create(
    portfolioData: Partial<Portfolio>,
    manager?: EntityManager
  ): Portfolio {
    // Note: 'create' doesn't hit the DB; it just instantiates the entity.
    // 'save' will persist it.
    const repository = manager
      ? manager.getRepository(Portfolio)
      : this.portfolioRepo;
    return repository.create(portfolioData);
  }
}
