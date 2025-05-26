import { Module } from "@nestjs/common";
import { TransactionsController } from "./controllers/transactions.controller";
import { TransactionsService } from "./services/transactions.service";
import { FuseModule } from "../../external/fuse/fuse.module";
import { RepositoryModule } from "../../database/repositories/repository.module";
import { PortfoliosModule } from "../portfolios/portfolios.module";

@Module({
  imports: [FuseModule, RepositoryModule, PortfoliosModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
