import { Module } from "@nestjs/common";
import { StocksController } from "./controllers/stocks.controller";
import { StocksService } from "./services/stocks.service";
import { FuseModule } from "../../external/fuse/fuse.module";

@Module({
  imports: [FuseModule],
  controllers: [StocksController],
  providers: [StocksService],
})
export class StocksModule {}
