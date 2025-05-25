import { Portfolio } from "../../../../database/entities/portfolio.entity";
import { PortfolioPropertiesDTO } from "./PortfolioPropertiesDTO";

export class FindPortfolioByUserIdResponseDTO {
  public readonly portfolios: PortfolioPropertiesDTO[];

  static fromDomain(portfolios: Portfolio[]): FindPortfolioByUserIdResponseDTO {
    return {
      portfolios: portfolios.map(PortfolioPropertiesDTO.fromDomain),
    };
  }
}
