import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  IPortfolioRepository,
  PORTFOLIO_REPOSITORY_TOKEN,
} from "../../../database/repositories/interfaces/portfolio-repository.interface";
import { Portfolio } from "../../../database/entities/portfolio.entity";
import { version as uuidVersion, validate as uuidValidate } from "uuid";

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
