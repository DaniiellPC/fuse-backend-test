import { Portfolio } from "../../../../database/entities/portfolio.entity";
import { PortfolioPropertiesDTO } from "./PortfolioPropertiesDTO";

export class GetPortfolioByUserIdResponseDTO {
  public readonly portfolios: PortfolioPropertiesDTO[];

  static fromDomain(portfolios: Portfolio[]): GetPortfolioByUserIdResponseDTO {
    return {
      portfolios: portfolios.map(PortfolioPropertiesDTO.fromDomain),
    };
  }
}
