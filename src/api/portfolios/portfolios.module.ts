import { Module } from "@nestjs/common";
import { PortfoliosController } from "./controllers/portfolios.controller";
import { PortfoliosService } from "./services/portfolios.service";
import { RepositoryModule } from "../../database/repositories/repository.module";

@Module({
  imports: [RepositoryModule],
  controllers: [PortfoliosController],
  providers: [PortfoliosService],
})
export class PortfoliosModule {}
