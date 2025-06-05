import { Test, TestingModule } from "@nestjs/testing";
import {
  INestApplication,
  HttpStatus,
  ValidationPipe,
  Module,
} from "@nestjs/common";
import * as request from "supertest";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { ScheduleModule } from "@nestjs/schedule";
import { HttpModule } from "@nestjs/axios";
import { DataSource, DeepPartial } from "typeorm";
import { setupServer, SetupServerApi } from "msw/node";
import { http, HttpResponse, RequestHandler, passthrough } from "msw";
import { v4 as uuidv4 } from "uuid";
import { User } from "../../../src/database/entities/user.entity";
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from "../../../src/database/entities/transaction.entity";
import { Portfolio } from "../../../src/database/entities/portfolio.entity";

// DTOs
import { BuyStockRequestDTO } from "../../../src/api/transactions/controllers/dtos/BuyStockRequestDTO";
import { BuyStockResponseDTO } from "../../../src/api/transactions/controllers/dtos/BuyStockResponseDTO";

// Modules
import { TransactionsModule } from "../../../src/api/transactions/transactions.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  IUserRepository,
  USER_REPOSITORY_TOKEN,
} from "../../../src/database/repositories/interfaces/user-repository.interface";
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY_TOKEN,
} from "../../../src/database/repositories/interfaces/transaction-repository.interface";
import {
  IPortfolioRepository,
  PORTFOLIO_REPOSITORY_TOKEN,
} from "../../../src/database/repositories/interfaces/portfolio-repository.interface";
import { clearDatabase, seedDatabase } from "../utils/test-database";
import { FuseStocksDataItem } from "../../../src/external/fuse/types/GetFuseStocksResponse";
import {
  BuyFuseStockResponse,
  BuyFuseStocksDataOrder,
} from "../../../src/external/fuse/types/BuyFuseStocksResponse";
import { retryOperation } from "../utils/retriesFunctionHelper";

const FUSE_API_BASE_URL = "http://mocked-fuse-api.com";
const FUSE_API_KEY = "mocked-fuse-api-key";

const mockStockAAPL: FuseStocksDataItem = {
  symbol: "AAPL",
  name: "Apple Inc.",
  price: 150.0,
  lastUpdate: new Date(),
  change: 1.0,
  sector: "Technology",
};
const mockStockGOOG: FuseStocksDataItem = {
  symbol: "GOOG",
  name: "Google LLC",
  price: 2500.0,
  lastUpdate: new Date(),
  change: -10.5,
  sector: "Technology",
};
const initialMockFuseStocks: FuseStocksDataItem[] = [
  mockStockAAPL,
  mockStockGOOG,
];

// MSW Handlers
const defaultMSWHandlers: RequestHandler[] = [
  http.get(FUSE_API_BASE_URL + "/stocks", ({ request }) => {
    const actualApiKey = request.headers.get("x-api-key");
    if (actualApiKey !== FUSE_API_KEY) {
      return new HttpResponse(null, { status: 401 });
    }
    return HttpResponse.json({
      data: { items: initialMockFuseStocks, nextToken: null },
      status: 200,
    });
  }),
  http.post(
    FUSE_API_BASE_URL + "/stocks/:symbol/buy",
    async ({ request, params }) => {
      const actualApiKey = request.headers.get("x-api-key");
      if (actualApiKey !== FUSE_API_KEY) {
        return new HttpResponse(null, { status: 401 });
      }
      const { symbol } = params;
      const reqBody = (await request.json()) as {
        quantity: number;
        price: number;
      };
      const mockOrder: BuyFuseStocksDataOrder = {
        symbol: symbol as string,
        quantity: reqBody.quantity,
        price: reqBody.price,
        total: reqBody.quantity * reqBody.price,
      };
      return HttpResponse.json({
        status: 200,
        message: "Order placed successfully",
        data: { order: mockOrder },
      } as BuyFuseStockResponse);
    }
  ),
  http.all(/127\.0\.0\.1/, async ({ request }) => {
    console.log(
      `[MSW Passthrough] Explicitly letting request to ${request.url} (127.0.0.1) pass through.`
    );
    return passthrough();
  }),
  http.all(/localhost/, async ({ request }) => {
    console.log(
      `[MSW Passthrough] Explicitly letting request to ${request.url} (localhost) pass through.`
    );
    return passthrough();
  }),
];

const server: SetupServerApi = setupServer(...defaultMSWHandlers);

// Minimal Test Module for Transactions
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        () => ({
          fuse: {
            baseUrl: FUSE_API_BASE_URL,
            apiKey: FUSE_API_KEY,
            stockPriceCacheTtlMilis: 5000,
            maxPagesToFetch: 1,
            maxApiRetries: 1,
          },
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
        entities: [User, Transaction, Portfolio],
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
    TransactionsModule,
    ScheduleModule.forRoot(),
    HttpModule,
  ],
})
class MinimalTransactionsTestModule {}

describe("TransactionsController (Integration)", () => {
  let app: INestApplication;
  let cacheManager: Cache;
  let internalCacheStore: Map<string, any>;
  let dataSource: DataSource;
  let userRepository: IUserRepository;
  let transactionRepository: ITransactionRepository;
  let portfolioRepository: IPortfolioRepository;

  const mockCacheProvider = {
    get: jest.fn(async (key: string) => internalCacheStore.get(key)),
    set: jest.fn(async (key: string, value: any, _ttl?: number) => {
      internalCacheStore.set(key, value);
      return Promise.resolve();
    }),
    del: jest.fn(async (key: string) => {
      internalCacheStore.delete(key);
      return Promise.resolve();
    }),
    reset: jest.fn(async () => {
      internalCacheStore.clear();
      return Promise.resolve();
    }),
    store: {
      keys: jest.fn(async () => Array.from(internalCacheStore.keys())),
    },
  } as unknown as Cache;

  beforeAll(async () => {
    server.listen({ onUnhandledRequest: "warn" });
    internalCacheStore = new Map<string, any>();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MinimalTransactionsTestModule],
    })
      .overrideProvider(CACHE_MANAGER)
      .useValue(mockCacheProvider)
      .compile();

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
    userRepository = moduleFixture.get<IUserRepository>(USER_REPOSITORY_TOKEN);
    transactionRepository = moduleFixture.get<ITransactionRepository>(
      TRANSACTION_REPOSITORY_TOKEN
    );
    portfolioRepository = moduleFixture.get<IPortfolioRepository>(
      PORTFOLIO_REPOSITORY_TOKEN
    );
    cacheManager = moduleFixture.get<Cache>(CACHE_MANAGER);
  });

  beforeEach(async () => {
    server.resetHandlers(...defaultMSWHandlers);
    if (typeof (mockCacheProvider as any).reset === "function") {
      await (mockCacheProvider as any).reset();
    } else {
      internalCacheStore.clear();
    }
    (mockCacheProvider.get as jest.Mock).mockClear();
    (mockCacheProvider.set as jest.Mock).mockClear();
    (mockCacheProvider.del as jest.Mock).mockClear();

    await clearDatabase(app);
    await seedDatabase(app);

    await cacheManager.set(
      "all_stocks_symbols_list",
      initialMockFuseStocks.map((s) => s.symbol),
      300
    );
    for (const stock of initialMockFuseStocks) {
      await cacheManager.set("stock:" + stock.symbol, stock, 300);
    }
  });

  afterAll(async () => {
    server.close();
    if (app) {
      await app.close();
    }

    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  describe("POST /transactions/buy", () => {
    let testUser: User;
    const stockToBuy = mockStockAAPL;

    beforeEach(async () => {
      const userToCreateData: DeepPartial<User> = {
        id: uuidv4(),
        username: "testuser_" + Date.now(),
        balance: 10000,
        email: "testuser_" + Date.now() + "@example.com",
        password_hash: "testpassword",
      };

      console.log("userToCreateData", userToCreateData);

      const newUserEntity = dataSource
        .getRepository(User)
        .create(userToCreateData);
      testUser = await userRepository.save(newUserEntity);

      // Verification step
      const checkUser = await userRepository.findOneById(testUser.id);
      if (!checkUser) {
        const errorMsg = `[beforeEach POST /transactions/buy] CRITICAL: User ${testUser.id} (username: ${testUser.username}) not found immediately after save using userRepository!`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      } else {
        console.log(
          `[beforeEach POST /transactions/buy] User ${testUser.id} (username: ${testUser.username}, balance: ${checkUser.balance}) successfully created and verified in DB via userRepository.`
        );
      }
    });

    it("should successfully buy a stock", async () => {
      const requestBody: BuyStockRequestDTO = {
        userId: testUser.id,
        symbol: stockToBuy.symbol,
        price: stockToBuy.price,
        quantity: 2,
      };
      const expectedTotalCost = requestBody.quantity * requestBody.price;

      const buyStock = () =>
        request(app.getHttpServer())
          .post("/transactions/buy")
          .send(requestBody)
          .expect(HttpStatus.CREATED);

      const response = await retryOperation(buyStock, (error) => {
        return error.status === HttpStatus.NOT_FOUND;
      });

      const responseDto = response.body as BuyStockResponseDTO;
      expect(responseDto.transaction.user_id).toBe(testUser.id);
      expect(responseDto.transaction.stock_symbol).toBe(stockToBuy.symbol);
      expect(responseDto.transaction.transaction_type).toBe(
        TransactionType.BUY
      );
      expect(responseDto.transaction.quantity).toBe(requestBody.quantity);
      expect(responseDto.transaction.price_at_transaction).toBe(
        requestBody.price
      );

      const formattedTotalAmount = Number(
        parseFloat(expectedTotalCost.toString()).toFixed(2)
      );
      expect(responseDto.transaction.total_amount).toBe(formattedTotalAmount);
      expect(responseDto.transaction.status).toBe(TransactionStatus.COMPLETED);
      expect(responseDto.transaction.id).toBeDefined();

      const transactionRepo = dataSource.getRepository(Transaction);
      const dbTransaction = await transactionRepo.findOneBy({
        id: responseDto.transaction.id,
      });
      expect(dbTransaction).toBeDefined();
      expect(dbTransaction!.status).toBe(TransactionStatus.COMPLETED);
      expect(Number(dbTransaction!.total_amount)).toBe(expectedTotalCost);

      const userRepo = dataSource.getRepository(User);
      const dbUser = await userRepo.findOneBy({ id: testUser.id });
      expect(dbUser).toBeDefined();
      expect(Number(dbUser!.balance)).toBe(
        parseFloat((testUser.balance - expectedTotalCost).toFixed(4))
      );

      const portfolioRepo = dataSource.getRepository(Portfolio);
      const dbPortfolio = await portfolioRepo.findOne({
        where: { user_id: testUser.id, stock_symbol: stockToBuy.symbol },
      });
      expect(dbPortfolio).toBeDefined();
      expect(dbPortfolio!.quantity).toBe(requestBody.quantity);
      expect(Number(dbPortfolio!.average_buy_price)).toBe(requestBody.price);
    });

    it("should return 404 if user not found", async () => {
      const nonExistentUserId = uuidv4();
      const requestBody: BuyStockRequestDTO = {
        userId: nonExistentUserId,
        symbol: stockToBuy.symbol,
        price: stockToBuy.price,
        quantity: 1,
      };

      const response = await request(app.getHttpServer())
        .post("/transactions/buy")
        .send(requestBody)
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toBe("User Not Found");

      const transactionRepo = dataSource.getRepository(Transaction);
      const failedTransactions = await transactionRepo.findBy({
        user_id: nonExistentUserId,
      });
      expect(failedTransactions.length).toBe(0);
    });

    it("should return 400 for insufficient funds", async () => {
      const userRepo = dataSource.getRepository(User);
      testUser.balance = 50;
      await userRepo.save(testUser);

      const requestBody: BuyStockRequestDTO = {
        userId: testUser.id,
        symbol: stockToBuy.symbol,
        price: stockToBuy.price,
        quantity: 1,
      };

      const response = await request(app.getHttpServer())
        .post("/transactions/buy")
        .send(requestBody)
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.message).toBe("Insufficient Funds");

      const transactionRepo = dataSource.getRepository(Transaction);
      const failedTransactions = await transactionRepo.findBy({
        user_id: testUser.id,
        stock_symbol: stockToBuy.symbol,
        status: TransactionStatus.FAILED,
      });
      const failedTransaction = failedTransactions.find(
        (t) => t.message === "Insufficient Funds"
      );
      expect(failedTransaction).toBeDefined();
    });

    it("should return 400 if stock price is invalid (client price differs >2% from cached price)", async () => {
      const requestBody: BuyStockRequestDTO = {
        userId: testUser.id,
        symbol: stockToBuy.symbol,
        price: 180,
        quantity: 1,
      };

      const response = await request(app.getHttpServer())
        .post("/transactions/buy")
        .send(requestBody)
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.message).toBe(
        "The purchase price is not correct or valid."
      );
      const transactionRepo = dataSource.getRepository(Transaction);
      const failedTransactions = await transactionRepo.findBy({
        user_id: testUser.id,
        stock_symbol: stockToBuy.symbol,
        status: TransactionStatus.FAILED,
      });
      const failedTransaction = failedTransactions.find(
        (t) => t.message === "The purchase price is not correct or valid."
      );
      expect(failedTransaction).toBeDefined();
    });

    it("should handle external Fuse API purchase failure", async () => {
      server.use(
        http.post(
          FUSE_API_BASE_URL + "/stocks/" + stockToBuy.symbol + "/buy",
          () => {
            return HttpResponse.json(
              { status: 500, message: "Fuse API Error from MSW" },
              { status: 500 }
            );
          }
        )
      );

      const requestBody: BuyStockRequestDTO = {
        userId: testUser.id,
        symbol: stockToBuy.symbol,
        price: stockToBuy.price,
        quantity: 1,
      };

      const response = await request(app.getHttpServer())
        .post("/transactions/buy")
        .send(requestBody)
        .expect(HttpStatus.BAD_GATEWAY);

      expect(response.body.message).toBeDefined();

      const transactionRepo = dataSource.getRepository(Transaction);
      const failedTransactions = await transactionRepo.findBy({
        user_id: testUser.id,
        stock_symbol: stockToBuy.symbol,
      });
      expect(failedTransactions.length).toBe(0);
    });

    describe("DTO Validation", () => {
      const baseValidBody: BuyStockRequestDTO = {
        userId: uuidv4(),
        symbol: "AAPL",
        price: 150,
        quantity: 1,
      };

      beforeEach(() => {
        baseValidBody.userId = testUser.id;
      });

      it("should return 400 if userId is missing", async () => {
        const { userId, ...invalidBody } = baseValidBody;
        await request(app.getHttpServer())
          .post("/transactions/buy")
          .send(invalidBody)
          .expect(HttpStatus.BAD_REQUEST)
          .then((res) => {
            expect(res.body.message).toEqual(
              expect.arrayContaining([
                "userId cannot be empty.",
                "userId must be a UUID",
              ])
            );
          });
      });
      it("should return 400 if userId is not a UUID", async () => {
        await request(app.getHttpServer())
          .post("/transactions/buy")
          .send({ ...baseValidBody, userId: "not-a-uuid" })
          .expect(HttpStatus.BAD_REQUEST)
          .then((res) => {
            expect(res.body.message).toEqual(
              expect.arrayContaining(["userId must be a UUID"])
            );
          });
      });

      it("should return 400 if symbol is missing", async () => {
        const { symbol, ...invalidBody } = baseValidBody;
        await request(app.getHttpServer())
          .post("/transactions/buy")
          .send(invalidBody)
          .expect(HttpStatus.BAD_REQUEST)
          .then((res) => {
            expect(res.body.message).toEqual(
              expect.arrayContaining(["symbol cannot be empty."])
            );
          });
      });

      it("should return 400 if price is missing", async () => {
        const { price, ...invalidBody } = baseValidBody;
        await request(app.getHttpServer())
          .post("/transactions/buy")
          .send(invalidBody)
          .expect(HttpStatus.BAD_REQUEST)
          .then((res) => {
            expect(res.body.message).toEqual(
              expect.arrayContaining([
                "Price must be a number with up to two decimal places.",
              ])
            );
          });
      });

      it("should return 400 if price is not a number", async () => {
        await request(app.getHttpServer())
          .post("/transactions/buy")
          .send({ ...baseValidBody, price: "not-a-number" })
          .expect(HttpStatus.BAD_REQUEST)
          .then((res) => {
            expect(res.body.message).toEqual(
              expect.arrayContaining([
                "Price must be a number with up to two decimal places.",
              ])
            );
          });
      });

      it("should return 400 if price has too many decimal places", async () => {
        await request(app.getHttpServer())
          .post("/transactions/buy")
          .send({ ...baseValidBody, price: 150.123 })
          .expect(HttpStatus.BAD_REQUEST)
          .then((res) => {
            expect(res.body.message).toEqual(
              expect.arrayContaining([
                "Price must be a number with up to two decimal places.",
              ])
            );
          });
      });

      it("should return 400 if quantity is missing", async () => {
        const { quantity, ...invalidBody } = baseValidBody;
        await request(app.getHttpServer())
          .post("/transactions/buy")
          .send(invalidBody)
          .expect(HttpStatus.BAD_REQUEST)
          .then((res) => {
            expect(res.body.message).toEqual(
              expect.arrayContaining([
                "Quantity must be an integer.",
                "Quantity must be at least 1.",
              ])
            );
          });
      });

      it("should return 400 if quantity is not an integer", async () => {
        await request(app.getHttpServer())
          .post("/transactions/buy")
          .send({ ...baseValidBody, quantity: 10.5 })
          .expect(HttpStatus.BAD_REQUEST)
          .then((res) => {
            expect(res.body.message).toEqual(
              expect.arrayContaining(["Quantity must be an integer."])
            );
          });
      });

      it("should return 400 if quantity is less than 1", async () => {
        await request(app.getHttpServer())
          .post("/transactions/buy")
          .send({ ...baseValidBody, quantity: 0 })
          .expect(HttpStatus.BAD_REQUEST)
          .then((res) => {
            expect(res.body.message).toEqual(
              expect.arrayContaining(["Quantity must be at least 1."])
            );
          });
      });
    });
  });
});
