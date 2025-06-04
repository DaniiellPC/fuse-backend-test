import { Test, TestingModule } from "@nestjs/testing";
import {
  INestApplication,
  HttpStatus,
  ValidationPipe,
  Module,
} from "@nestjs/common";
import * as request from "supertest";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DataSource, DeepPartial } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { User } from "../../../src/database/entities/user.entity";
import { Portfolio } from "../../../src/database/entities/portfolio.entity";
import { Transaction } from "../../../src/database/entities/transaction.entity";
import { FindPortfolioByUserIdResponseDTO } from "../../../src/api/portfolios/controllers/dtos/FindPortfolioByUserIdResponseDTO";
import { PortfoliosModule } from "../../../src/api/portfolios/portfolios.module";
import { clearDatabase } from "../utils/test-database";

// Minimal Test Module for Portfolios
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        () => ({
          database: {
            host: process.env.DATABASE_HOST,
            port: parseInt(process.env.DATABASE_PORT || "5432", 10),
            username: process.env.DATABASE_USERNAME,
            password: process.env.DATABASE_PASSWORD,
            name: process.env.DATABASE_NAME,
            ssl: process.env.DB_SSL === "true",
          },
        }),
      ],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        host: configService.get<string>("database.host"),
        port: configService.get<number>("database.port"),
        username: configService.get<string>("database.username"),
        password: configService.get<string>("database.password"),
        database: configService.get<string>("database.name"),
        entities: [User, Portfolio, Transaction],
        migrations: ["dist/src/database/migrations/*.js"],
        migrationsRun: false,
        synchronize: false,
        autoLoadEntities: false,
        logging: false,
        ssl: configService.get<boolean>("database.ssl")
          ? { rejectUnauthorized: false }
          : false,
      }),
      inject: [ConfigService],
    }),
    PortfoliosModule,
  ],
})
class MinimalPortfoliosTestModule {}

describe("PortfoliosController (Integration)", () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const createUserInDb = async (userData: DeepPartial<User>): Promise<User> => {
    const userRepo = dataSource.getRepository(User);
    const user = userRepo.create(userData);
    return userRepo.save(user);
  };

  const createPortfolioInDb = async (
    portfolioData: DeepPartial<Portfolio>
  ): Promise<Portfolio> => {
    const portfolioRepo = dataSource.getRepository(Portfolio);
    const portfolio = portfolioRepo.create(portfolioData);
    return portfolioRepo.save(portfolio);
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MinimalPortfoliosTestModule],
    }).compile();

    app = moduleFixture.createNestApplication({
      logger: ["error"],
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      })
    );
    await app.init();

    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await clearDatabase(app);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  describe("GET /portfolios/:userId/portfolio - FindPortfolioByUserId", () => {
    let testUser: User;
    let userPortfolio: Portfolio[];

    beforeEach(async () => {
      testUser = await createUserInDb({
        id: uuidv4(),
        username: "portfolio_user",
        balance: 1000,
        email: "portfolio_user@example.com",
        password_hash: "hashedpassword",
      });

      userPortfolio = [];
    });

    it("should successfully retrieve a user's portfolio", async () => {
      const portfolioItem1 = await createPortfolioInDb({
        user_id: testUser.id,
        stock_symbol: "AAPL",
        quantity: 10,
        average_buy_price: 150.0,
      });
      const portfolioItem2 = await createPortfolioInDb({
        user_id: testUser.id,
        stock_symbol: "GOOG",
        quantity: 5,
        average_buy_price: 2500.0,
      });
      userPortfolio = [portfolioItem1, portfolioItem2];

      const response = await request(app.getHttpServer())
        .get(`/portfolios/${testUser.id}/portfolio`)
        .expect(HttpStatus.OK);

      const responseDto = response.body as FindPortfolioByUserIdResponseDTO;
      expect(responseDto.portfolios).toBeInstanceOf(Array);
      expect(responseDto.portfolios).toHaveLength(userPortfolio.length);

      // Verify structure and some data of each portfolio item
      userPortfolio.forEach((expectedItem) => {
        const actualItem = responseDto.portfolios.find(
          (p) => p.id === expectedItem.id
        );
        expect(actualItem).toBeDefined();
        expect(actualItem?.user_id).toBe(expectedItem.user_id);
        expect(actualItem?.stock_symbol).toBe(expectedItem.stock_symbol);
        expect(actualItem?.quantity).toBe(expectedItem.quantity);
        expect(Number(actualItem?.average_buy_price)).toBe(
          expectedItem.average_buy_price
        );
        expect(actualItem?.id).toBeDefined();
        expect(actualItem?.created_at).toBeDefined();
        expect(actualItem?.updated_at).toBeDefined();
      });
    });

    it("should return 404 if user has no portfolio items", async () => {
      // testUser is created, but no portfolio items are linked to them by default

      const response = await request(app.getHttpServer())
        .get(`/portfolios/${testUser.id}/portfolio`)
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toBe(
        `Portfolio(s) for user ${testUser.id} not found`
      );
    });

    it("should return 404 if user ID is valid UUID but user does not exist (and thus has no portfolio)", async () => {
      const nonExistentUserId = uuidv4();
      const response = await request(app.getHttpServer())
        .get(`/portfolios/${nonExistentUserId}/portfolio`)
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toBe(
        `Portfolio(s) for user ${nonExistentUserId} not found`
      );
    });

    it("should return 400 if userId is not a valid UUIDv4", async () => {
      const invalidUserId = "not-a-uuid";
      const response = await request(app.getHttpServer())
        .get(`/portfolios/${invalidUserId}/portfolio`)
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.message).toBe(
        `User ID ${invalidUserId} is not a valid UUIDv4`
      );
    });
  });
});
