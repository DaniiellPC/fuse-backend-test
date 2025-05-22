import { Module } from "@nestjs/common";
import { StocksModule } from "./api/stocks/stocks.module";
import { ConfigModule, ConfigService } from "@nestjs/config";
import config from "./utils/config";
import { CacheModule } from "@nestjs/cache-manager";
import { ScheduleModule } from "@nestjs/schedule";

@Module({
  imports: [
    StocksModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
      load: [config],
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        ttl: configService.get<number>("fuse.stockPriceCacheTtlSeconds") || 300,
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
