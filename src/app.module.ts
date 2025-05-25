import { Module } from "@nestjs/common";
import { StocksModule } from "./api/stocks/stocks.module";
import { ConfigModule, ConfigService } from "@nestjs/config";
import config from "./utils/config";
import { CacheModule } from "@nestjs/cache-manager";
import { ScheduleModule } from "@nestjs/schedule";
import { TransactionsModule } from "./api/transactions/transactions.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PortfoliosModule } from "./api/portfolios/portfolios.module";
import { ReportsModule } from "./reports/reports.module";

@Module({
  imports: [
    StocksModule,
    TransactionsModule,
    PortfoliosModule,
    ReportsModule,
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
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const dbConfig = configService.get("database");
        console.log("Loading database configuration...", dbConfig);
        return {
          type: dbConfig.type,
          host: dbConfig.host,
          port: dbConfig.port,
          username: dbConfig.username,
          password: dbConfig.password,
          database: dbConfig.database,
          synchronize: dbConfig.synchronize,
          logging: dbConfig.logging,
          entities: [__dirname + "/**/*.entity{.ts,.js}"],
          // Here add ssl: { rejectUnauthorized: false } for RDS
        };
      },
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
