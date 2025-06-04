import { Test, TestingModule } from "@nestjs/testing";
import {
  INestApplication,
  HttpStatus,
  Module,
  ValidationPipe,
} from "@nestjs/common";
import * as request from "supertest";
import { StocksModule } from "../../../src/api/stocks/stocks.module";
import { ConfigModule } from "@nestjs/config";
import { CACHE_MANAGER, CacheModule } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { createMockStockItem } from "../utils/createMockStockItemHelper";
import { ScheduleModule } from "@nestjs/schedule";
import { HttpModule } from "@nestjs/axios";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

const mockStock1 = createMockStockItem("AAPL", "Apple Inc.", 150.0);
const mockStock2 = createMockStockItem("GOOGL", "Alphabet Inc.", 2500.0);
const mockStock3 = createMockStockItem("MSFT", "Microsoft Corp.", 300.0);
const mockStock4 = createMockStockItem("AMZN", "Amazon.com Inc.", 3200.0);
const mockStock5 = createMockStockItem("TSLA", "Tesla Inc.", 700.0);
const allInitialMockStocks = [
  mockStock1,
  mockStock2,
  mockStock3,
  mockStock4,
  mockStock5,
];

const FUSE_API_BASE_URL = "http://mocked-fuse-api.com"; // For MSW handlers
const FUSE_API_KEY = "mocked-fuse-api-key"; // For MSW handlers

const handlers = [
  http.get(`${FUSE_API_BASE_URL}/stocks`, ({ request }) => {
    const actualApiKey = request.headers.get("x-api-key");
    if (actualApiKey === FUSE_API_KEY) {
      return HttpResponse.json({
        data: { items: allInitialMockStocks, nextToken: null },
        status: 200,
      });
    }
    return new HttpResponse(null, { status: 401 });
  }),
];

const server = setupServer(...handlers);

@Module({
  imports: [
    StocksModule,
    HttpModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        () => ({
          fuse: {
            baseUrl: FUSE_API_BASE_URL,
            apiKey: FUSE_API_KEY,
            stockPriceCacheTtlMilis: 300000,
            stockPriceCacheTtlSeconds: 300,
            maxPagesToFetch: 100,
            maxApiRetries: 3,
          },
        }),
      ],
    }),
    CacheModule.register({ isGlobal: true }),
    ScheduleModule.forRoot(),
  ],
})
class MinimalStocksTestModule {}

describe("StocksController (Integration) with MSW", () => {
  let app: INestApplication;
  let cacheManager: Cache;
  let internalCacheStore: Map<string, any>;

  beforeAll(async () => {
    server.listen({ onUnhandledRequest: "warn" });

    internalCacheStore = new Map<string, any>();
    const mockCacheProvider = {
      get: jest.fn(async (key: string) => internalCacheStore.get(key)),
      set: jest.fn(async (key: string, value: any) => {
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
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MinimalStocksTestModule],
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
      })
    );
    cacheManager = moduleFixture.get<Cache>(CACHE_MANAGER);

    await app.init();
  });

  beforeEach(async () => {
    (cacheManager.get as jest.Mock).mockClear();
    (cacheManager.set as jest.Mock).mockClear();
    (cacheManager.del as jest.Mock).mockClear();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(async () => {
    server.close();
    if (app) {
      await app.close();
    }
  });

  describe("GET /stocks - List Stocks", () => {
    it("should return default paginated stocks (page 1, limit 10) from cache (populated on init)", async () => {
      const response = await request(app.getHttpServer())
        .get("/stocks")
        .expect(HttpStatus.OK);

      expect(response.body.items).toHaveLength(allInitialMockStocks.length);
      expect(response.body.items[0].symbol).toBe(
        allInitialMockStocks[0].symbol
      );
      expect(response.body.totalItems).toBe(allInitialMockStocks.length);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
      expect(response.body.totalPages).toBe(
        Math.ceil(allInitialMockStocks.length / 10)
      );
    });

    it("should return custom paginated stocks (page 2, limit 2) from cache (populated on init)", async () => {
      const response = await request(app.getHttpServer())
        .get("/stocks?page=2&limit=2")
        .expect(HttpStatus.OK);

      expect(response.body.items).toHaveLength(2);
      expect(response.body.items[0].symbol).toBe(
        allInitialMockStocks[2].symbol
      );
      expect(response.body.items[1].symbol).toBe(
        allInitialMockStocks[3].symbol
      );
      expect(response.body.totalItems).toBe(allInitialMockStocks.length);
      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(2);
      expect(response.body.totalPages).toBe(
        Math.ceil(allInitialMockStocks.length / 2)
      );
    });

    it("should handle pagination correctly when total stocks (from init) is less than limit", async () => {
      const response = await request(app.getHttpServer())
        .get("/stocks?page=1&limit=10") // Limit is higher than total items
        .expect(HttpStatus.OK);

      expect(response.body.items).toHaveLength(allInitialMockStocks.length);
      expect(response.body.totalItems).toBe(allInitialMockStocks.length);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
      expect(response.body.totalPages).toBe(1);
    });

    it("should return an empty list if vendor initially has no stocks", async () => {
      server.use(
        http.get(`${FUSE_API_BASE_URL}/stocks`, ({ request }) => {
          const actualApiKey = request.headers.get("x-api-key");

          if (actualApiKey === FUSE_API_KEY) {
            return HttpResponse.json({
              data: { items: [], nextToken: null },
              status: 200,
            });
          }
          return new HttpResponse(null, { status: 401 });
        })
      );

      await (cacheManager as any).reset();

      const response = await request(app.getHttpServer())
        .get("/stocks")
        .expect(HttpStatus.OK);

      expect(response.body.items).toHaveLength(0);
      expect(response.body.totalItems).toBe(0);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
      expect(response.body.totalPages).toBe(0);
    });

    it("should handle vendor API error gracefully when fetching initial stocks", async () => {
      server.use(
        http.get(`${FUSE_API_BASE_URL}/stocks`, ({ request }) => {
          const actualApiKey = request.headers.get("x-api-key");
          if (actualApiKey === FUSE_API_KEY) {
            return new HttpResponse(
              JSON.stringify({ message: "Vendor API Error" }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" },
              }
            );
          }
          return new HttpResponse(null, { status: 401 });
        })
      );

      await (cacheManager as any).reset();

      const response = await request(app.getHttpServer())
        .get("/stocks")
        .expect(HttpStatus.SERVICE_UNAVAILABLE);

      expect(response.body.message).toContain("Could not get available stocks");
    });

    it("should use cached stocks and not call vendor again", async () => {
      internalCacheStore.clear();
      await (cacheManager as any).set(
        "all_stocks_symbols_list",
        allInitialMockStocks.map((s) => s.symbol)
      );
      for (const stock of allInitialMockStocks) {
        await (cacheManager as any).set(`stock:${stock.symbol}`, stock);
      }

      server.use(
        http.get(`${FUSE_API_BASE_URL}/stocks`, ({ request }) => {
          return new HttpResponse(
            "Error: External API was called when cache should have been used",
            { status: 503 }
          );
        })
      );

      const response = await request(app.getHttpServer())
        .get("/stocks?page=1&limit=3")
        .expect(HttpStatus.OK);

      expect(response.body.items).toHaveLength(3);
      expect(response.body.items[0].symbol).toBe(
        allInitialMockStocks[0].symbol
      );
      expect(response.body.totalItems).toBe(allInitialMockStocks.length);

      expect(cacheManager.get).toHaveBeenCalledWith("all_stocks_symbols_list");
      expect(cacheManager.get).toHaveBeenCalledWith(
        `stock:${allInitialMockStocks[0].symbol}`
      );
    });

    describe("GET /stocks - Invalid Query Parameters", () => {
      const stocksForInvalidParamsTest = [mockStock1, mockStock2];

      beforeEach(async () => {
        internalCacheStore.clear();
        await cacheManager.set(
          "all_stocks_symbols_list",
          stocksForInvalidParamsTest.map((s) => s.symbol)
        );
        for (const stock of stocksForInvalidParamsTest) {
          await cacheManager.set(`stock:${stock.symbol}`, stock);
        }
      });

      it("should handle page=0, defaulting to page 1", async () => {
        const response = await request(app.getHttpServer())
          .get("/stocks?page=0&limit=1")
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.body.statusCode).toBe(400);
        expect(response.body.error).toBe("Bad Request");
        expect(response.body.message).toBeInstanceOf(Array);
        expect(response.body.message).toContain("Page must be at least 1");
      });

      it("should handle limit=0, defaulting to limit 1 (as per StocksService correction)", async () => {
        const response = await request(app.getHttpServer())
          .get("/stocks?page=1&limit=0")
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.body.statusCode).toBe(400);
        expect(response.body.error).toBe("Bad Request");
        expect(response.body.message).toBeInstanceOf(Array);
        expect(response.body.message).toContain("Limit must be at least 1");
      });

      it("should handle non-numeric page, defaulting to page 1 (DTO default)", async () => {
        const response = await request(app.getHttpServer())
          .get("/stocks?page=abc&limit=1")
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.body.statusCode).toBe(400);
        expect(response.body.error).toBe("Bad Request");
        expect(response.body.message).toBeInstanceOf(Array);
        expect(response.body.message).toEqual(
          expect.arrayContaining([
            expect.stringMatching(
              /Page must be a valid number|Page must be an integer number/
            ),
          ])
        );
      });

      it("should handle non-numeric limit, defaulting to limit 10 (DTO default)", async () => {
        const response = await request(app.getHttpServer())
          .get("/stocks?page=1&limit=xyz")
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.body.statusCode).toBe(400);
        expect(response.body.error).toBe("Bad Request");
        expect(response.body.message).toBeInstanceOf(Array);
        expect(response.body.message).toEqual(
          expect.arrayContaining([
            expect.stringMatching(
              /Limit must be a valid number|Limit must be an integer number/
            ),
          ])
        );
      });
    });
  });
});
