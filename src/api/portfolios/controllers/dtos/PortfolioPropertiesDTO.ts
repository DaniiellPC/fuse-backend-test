import { PortfolioProperties } from "../../../../database/entities/portfolio.entity";

export class PortfolioPropertiesDTO {
  public readonly id: string;
  public readonly user_id: string;
  public readonly stock_symbol: string;
  public readonly quantity: number;
  public readonly average_buy_price?: number;
  public readonly created_at: Date;
  public readonly updated_at: Date;

  static fromDomain(portfolio: PortfolioProperties): PortfolioPropertiesDTO {
    return {
      id: portfolio.id,
      user_id: portfolio.user_id,
      stock_symbol: portfolio.stock_symbol,
      quantity: portfolio.quantity,
      average_buy_price: portfolio.average_buy_price,
      created_at: portfolio.created_at,
      updated_at: portfolio.updated_at,
    };
  }
}
