import { Module } from "@nestjs/common";
import { StocksModule } from "./api/stocks/stocks.module";
import { ConfigModule, ConfigService } from "@nestjs/config";
import config from "./utils/config";
import { CacheModule } from "@nestjs/cache-manager";
import { ScheduleModule } from "@nestjs/schedule";
import { TransactionsModule } from "./api/transactions/transactions.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PortfoliosModule } from "./api/portfolios/portfolios.module";

@Module({
  imports: [
    StocksModule,
    TransactionsModule,
    PortfoliosModule,
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
          entities: [__dirname + "/**/*.entity{.ts,.js}"], // Ruta de tus entidades (ej. Transaction.entity.ts)
          // Aquí puedes añadir ssl: { rejectUnauthorized: false } para RDS si lo necesitas
        };
      },
      inject: [ConfigService], // Inyecta ConfigService
    }),
    ScheduleModule.forRoot(),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
