import { Module } from "@nestjs/common";
import { TransactionsController } from "./controllers/transactions.controller";
import { TransactionsService } from "./services/transactions.service";
import { FuseModule } from "../../external/fuse/fuse.module";
import { RepositoryModule } from "../../database/repositories/repository.module";

@Module({
  imports: [FuseModule, RepositoryModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
