import { Module } from "@nestjs/common";
import { StocksModule } from "./api/stocks/stocks.module";
import { ConfigModule } from "@nestjs/config";
import config from "./utils/config";

@Module({
  imports: [
    StocksModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
      load: [config],
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
