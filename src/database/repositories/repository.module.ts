import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../entities/user.entity";
import { Transaction } from "../entities/transaction.entity";
import { Portfolio } from "../entities/portfolio.entity";
import { UserRepository } from "./implementations/user.repository";
import { TransactionRepository } from "./implementations/transaction.repository";
import { PortfolioRepository } from "./implementations/portfolio.repository";
import { USER_REPOSITORY_TOKEN } from "./interfaces/user-repository.interface";
import { TRANSACTION_REPOSITORY_TOKEN } from "./interfaces/transaction-repository.interface";
import { PORTFOLIO_REPOSITORY_TOKEN } from "./interfaces/portfolio-repository.interface";

@Module({
  imports: [TypeOrmModule.forFeature([User, Transaction, Portfolio])],
  providers: [
    {
      provide: USER_REPOSITORY_TOKEN,
      useClass: UserRepository,
    },
    {
      provide: TRANSACTION_REPOSITORY_TOKEN,
      useClass: TransactionRepository,
    },
    {
      provide: PORTFOLIO_REPOSITORY_TOKEN,
      useClass: PortfolioRepository,
    },
  ],
  exports: [
    USER_REPOSITORY_TOKEN,
    TRANSACTION_REPOSITORY_TOKEN,
    PORTFOLIO_REPOSITORY_TOKEN,
  ],
})
export class RepositoryModule {}
