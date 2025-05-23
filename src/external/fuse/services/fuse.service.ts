import { HttpService } from "@nestjs/axios";
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { AxiosResponse } from "axios";
import { lastValueFrom, Observable } from "rxjs";
import { map, catchError, retry } from "rxjs/operators";
import {
  FuseStocksDataItem,
  GetFuseStocksResponse,
} from "../types/GetFuseStocksResponse";
import { BuyFuseStockResponse } from "../types/BuyFuseStocksResponse";
import { BuyFuseStockRequest } from "../types/BuyFuseStocksRequest";
import { ConfigService } from "@nestjs/config";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PaginatedListFuseStocks } from "../types/PaginatedListFuseStocks";
import {
  Transaction,
  TransactionStatus,
} from "../../../database/entities/transaction.entity";
import {
  IPortfolioRepository,
  PORTFOLIO_REPOSITORY_TOKEN,
} from "../../../database/repositories/interfaces/portfolio-repository.interface";
import { DataSource, EntityManager } from "typeorm";

@Injectable()
export class FuseService implements OnModuleInit {
  private readonly logger = new Logger(FuseService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly cacheTtlMilis: number;
  private readonly maxPagesToFetch: number;
  private readonly maxApiRetries: number;

  // Cache key for the list of symbols(for the global 'reading')
  private readonly ALL_STOCKS_SYMBOLS_CACHE_KEY = "all_stocks_symbols_list";

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject(PORTFOLIO_REPOSITORY_TOKEN)
    private readonly portfolioRepository: IPortfolioRepository
  ) {
    this.baseUrl = this.configService.get<string>("fuse.baseUrl");
    this.apiKey = this.configService.get<string>("fuse.apiKey");
    this.cacheTtlMilis = this.configService.get<number>(
      "fuse.stockPriceCacheTtlMilis"
    );
    this.maxPagesToFetch =
      this.configService.get<number>("fuse.maxPagesToFetch") || 100;
    this.maxApiRetries = this.configService.get<number>("fuse.maxApiRetries");
  }
  // Run once the module has been initialized
  async onModuleInit() {
    this.logger.log(
      "VendorService initialized. Performing initial stock loading."
    );
    await this.fetchAndCacheAllStocksFromVendor();
  }

  /**
   * Cronjob to update periodically the cache with stocks
   * It runs every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  private async handleCronStockRefresh() {
    this.logger.log(`[Cron Job] Starting scheduled stock update.`);
    await this.fetchAndCacheAllStocksFromVendor();
    this.logger.log(`[Cron Job] Stock update completed.`);
  }

  /**
   * Gets a page from available stocks
   * First read the cache, If it's not in the cache or if it's expired,
   * triggers a call to the API and updates the Cache.
   * @param page Page number (1 by default).
   * @param limit Maximum number of items to fetch by page (10 by default).
   * @returns resolves a Promise with a PaginatedStocksResponse object.
   */
  async getAllStocks(
    page: number,
    limit: number
  ): Promise<PaginatedListFuseStocks> {
    this.logger.log(
      `Request to get stocks (Page: ${page}, Limit: ${limit}). Trying to read from cache.`
    );

    let allSymbols: string[] | undefined = await this.cacheManager.get(
      this.ALL_STOCKS_SYMBOLS_CACHE_KEY
    );

    // If cache is empty or expired, force a complete update
    if (!allSymbols || allSymbols.length === 0) {
      this.logger.warn(
        "Cache of symbols empty or expired. Forcing update from Vendor."
      );
      try {
        await this.fetchAndCacheAllStocksFromVendor();
        allSymbols = await this.cacheManager.get(
          this.ALL_STOCKS_SYMBOLS_CACHE_KEY
        ); // Re-read after update
        if (!allSymbols || allSymbols.length === 0) {
          this.logger.error(
            "Could not get stock symbols even after Vendor update."
          );
          throw new HttpException(
            "Could not get available stocks.",
            HttpStatus.SERVICE_UNAVAILABLE
          );
        }
      } catch (error) {
        this.logger.error(
          `Error while forcing update and getting stock symbols: ${error.message}`
        );
        throw error;
      }
    }

    const totalStocks = allSymbols.length;
    const totalPages = Math.ceil(totalStocks / limit);

    // Adjust the page if the number is too high
    if (page > totalPages && totalPages > 0) {
      page = totalPages;
    } else if (totalPages === 0) {
      page = 1; // If there are no stocks, the page is 1
    }

    const startIndex = (page - 1) * limit;
    const endIndex = Math.min(startIndex + limit, totalStocks);

    const paginatedSymbols = allSymbols.slice(startIndex, endIndex);
    const paginatedItems: FuseStocksDataItem[] = [];

    for (const symbol of paginatedSymbols) {
      const stock: FuseStocksDataItem | undefined = await this.cacheManager.get(
        `stock:${symbol}`
      );
      if (stock) {
        paginatedItems.push(stock);
      } else {
        // This could happen if an individual stock expired before the global list,
        // or if there was an error caching a specific stock.
        // For production-ready, this could trigger an alert or a specific re-fetch.
        this.logger.warn(
          `Individual stock ${symbol} not found in cache for current page.`
        );
      }
    }

    this.logger.log(
      `Returning ${paginatedItems.length} stocks for page ${page} of ${totalPages} (Total: ${totalStocks}).`
    );
    return {
      items: paginatedItems,
      total: totalStocks,
      page: page,
      limit: limit,
      totalPages: totalPages,
    };
  }

  getFuseStocks(param?: string): Observable<GetFuseStocksResponse> {
    const url = `${this.baseUrl}/stocks${param ? `?nextToken=${param}` : ""}`;
    this.logger.log(`Requesting data from FuseAPI: ${url}`);

    const options = {
      headers: {
        "x-api-key": this.apiKey,
      },
    };

    return this.httpService.get(url, options).pipe(
      map((response: AxiosResponse) => response.data),
      catchError((error) => {
        this.logger.error("Error fetching data from FuseAPI", error);
        throw error;
      })
    );
  }

  /**
   * Gets a specific stock by his symbol, looking first in the cache
   * If it's not in the cache or if it's expired, triggers a complete update via fetchAndCacheAllStocksFromVendor
   */
  async getStockBySymbol(symbol: string): Promise<FuseStocksDataItem | null> {
    const cacheKey = `stock:${symbol}`;
    const cachedStock: FuseStocksDataItem | undefined =
      await this.cacheManager.get(cacheKey);

    if (cachedStock) {
      this.logger.log(`Stock ${symbol} retrieved from cache.`);
      return cachedStock;
    }

    this.logger.warn(
      `Stock ${symbol} not found in cache or expired. Attempting to update global cache.`
    );

    try {
      await this.fetchAndCacheAllStocksFromVendor();
      const foundStock: FuseStocksDataItem | undefined =
        await this.cacheManager.get(cacheKey);
      if (foundStock) {
        this.logger.log(
          `Stock ${symbol} found and cached after forced update.`
        );
        return foundStock;
      } else {
        this.logger.warn(
          `Stock ${symbol} not found in Vendor response after update.`
        );
        return null;
      }
    } catch (error) {
      this.logger.error(
        `Failed to get and cache stocks to find ${symbol}: ${error.message}`
      );
      return null;
    }
  }

  /**
   * Compare the price from a given stock by the client with price cached,
   * Applying the 2% validation.
   * Avoids extra calls to the external API
   *
   * @param symbol (eg. "GOOG").
   * @param clientPrice Price given by the client
   * @returns A promise with the boolean validation result
   */
  async compareStockPrice(
    symbol: string,
    clientPrice: number
  ): Promise<boolean> {
    this.logger.log(
      `Iniciando comparación para stock: ${symbol} con precio del cliente: ${clientPrice}`
    );

    // Tries to get the stock from the cache
    const cachedStock = await this.getOnlyCachedStock(symbol);

    if (!cachedStock) {
      this.logger.warn(
        `Stock ${symbol} no encontrado en caché. No se puede realizar la validación de precio.`
      );
      return false;
    }

    // 2% validation
    const cachedPrice = cachedStock.price;
    const lowerBound = clientPrice * 0.98; // -2%
    const upperBound = clientPrice * 1.02; // +2%

    const isWithinRange =
      cachedPrice >= lowerBound && cachedPrice <= upperBound;

    if (isWithinRange) {
      this.logger.log(
        `El precio cacheado (${cachedPrice}) para '${symbol}' está dentro del 2% del precio del cliente (${clientPrice}).`
      );
      return true;
    } else {
      const difference = Math.abs(cachedPrice - clientPrice);
      const priceDifferencePercentage = (difference / clientPrice) * 100;
      this.logger.log(
        `El precio cacheado (${cachedPrice}) para '${symbol}' está FUERA del 2% del precio del cliente (${clientPrice}). Diferencia: ${priceDifferencePercentage.toFixed(
          2
        )}%.`
      );
      return false;
    }
  }

  /**
   * Process the purchase of a stock.
   * Uses custom repositories and a database transaction to ensure atomicity.
   * @param stockSymbol Stock symbol (eg. "GOOG").
   * @param quantity Number of shares to buy.
   * @param clientPrice Price per share that the client sees and accepts (already validated).
   * @param transactionRecord Transaction object to be updated.
   * @returns A transaction object with the result of the purchase.
   * @throws HttpException if the purchase fails.
   */
  async processExternalPurchase(
    stockSymbol: string,
    quantity: number,
    clientPrice: number,
    transactionRecord: Transaction
  ): Promise<Transaction> {
    try {
      // Calling external API
      this.logger.log(
        `Requesting purchase from FuseAPI for ${stockSymbol}, qty: ${quantity}, price: ${clientPrice}`
      );

      const apiResponse: BuyFuseStockResponse = await lastValueFrom(
        this.buyFuseStock(stockSymbol, clientPrice, quantity)
      );

      // Verificar la respuesta de éxito de la API externa
      if (
        apiResponse.status !== 200 ||
        apiResponse.message !== "Order placed successfully"
      ) {
        this.logger.error(
          `External purchase API failed or did not confirm the order for ${transactionRecord.getUserId()}. Response: ${JSON.stringify(
            apiResponse
          )}`
        );
        transactionRecord.updateStatus(TransactionStatus.FAILED);
        transactionRecord.setMessage(
          `Stock purchase failed by external provider: ${
            apiResponse.message || "Unknown error"
          }`
        );

        throw new HttpException(
          transactionRecord.getMessage(),
          HttpStatus.INTERNAL_SERVER_ERROR // O HttpStatus.BAD_GATEWAY
        );
      }
      this.logger.log(
        `Compra confirmada por FuseAPI para usuario ${transactionRecord.getUserId()}, stock ${stockSymbol}. Orden ID: ${
          apiResponse.data.order.symbol
        }`
      );

      transactionRecord.setMessage(
        "Orden confirmada por proveedor externo, pendiente de registro en base de datos."
      );

      return transactionRecord;
    } catch (error) {
      this.logger.error(
        `Error in FuseAPI communication for user ${transactionRecord.getUserId()}: ${
          error.message
        }`,
        error.stack
      );
      // If the error hasn't been caught and handled by `buyFuseStock`,
      // or if it's an HttpException thrown by `buyFuseStock`,
      // we just update the transaction and re-throw the error.
      if (transactionRecord.getStatus() !== TransactionStatus.FAILED) {
        transactionRecord.updateStatus(TransactionStatus.FAILED);
        transactionRecord.setMessage(
          `Error processing purchase with external provider: ${error.message}`
        );
      }
      throw error;
    }
  }

  buyFuseStock(
    symbolStock: string,
    price: number,
    quantity: number
  ): Observable<BuyFuseStockResponse> {
    const url = `${this.baseUrl}/stocks/${symbolStock}/buy`;
    this.logger.log(`Sending data from FuseAPI: ${url}`);

    const options = {
      headers: {
        "x-api-key": this.apiKey,
      },
    };

    const body: BuyFuseStockRequest = {
      price,
      quantity,
    };

    return this.httpService.post(url, body, options).pipe(
      map((response: AxiosResponse) => response.data),
      retry(this.maxApiRetries),
      catchError((error) => {
        this.logger.error("Error sending data to FuseAPI", error);
        throw new HttpException(
          `Error al conectar con el proveedor externo: ${error.message}`,
          HttpStatus.BAD_GATEWAY
        );
      })
    );
  }

  /**
   * Goes to the API and gets the pages
   * and insert/update the cache from each individual stock
   * updates the cache key for the complete list of symbols.
   */
  private async fetchAndCacheAllStocksFromVendor(): Promise<void> {
    this.logger.log(
      "Starting _fetchAndCacheAllStocksFromVendor: Getting fresh data from Vendor."
    );
    let allSymbols: string[] = []; // To store only the symbols
    let currentNextToken: string | undefined = undefined;
    let pageCount = 0;

    try {
      do {
        pageCount++;
        if (pageCount > this.maxPagesToFetch) {
          this.logger.warn(
            `Limit of ${this.maxPagesToFetch} pages reached in _fetchAndCacheAllStocksFromVendor. Stopping pagination.`
          );
          break;
        }

        const url = `${this.baseUrl}/stocks${
          currentNextToken ? `?nextToken=${currentNextToken}` : ""
        }`;
        const options = {
          headers: { "x-api-key": this.apiKey },
        };

        const response: AxiosResponse<GetFuseStocksResponse> =
          await lastValueFrom(
            this.httpService.get<GetFuseStocksResponse>(url, options).pipe(
              retry(this.maxApiRetries),
              catchError((error) => {
                this.logger.error(
                  `Error al obtener stocks del Vendor (Página ${pageCount}) en _fetchAndCacheAllStocksFromVendor: ${error.message}`,
                  error.stack
                );
                throw new HttpException(
                  "Fallo al conectar con el servicio de stocks del proveedor.",
                  HttpStatus.SERVICE_UNAVAILABLE
                );
              })
            )
          );

        const data = response.data.data;
        if (!data || !data.items) {
          this.logger.warn(
            `El Vendor no retornó datos o items en la página ${pageCount} en _fetchAndCacheAllStocksFromVendor.`
          );
          break;
        }

        currentNextToken = data.nextToken;

        for (const stock of data.items) {
          await this.cacheManager.set(
            `stock:${stock.symbol}`,
            stock,
            this.cacheTtlMilis
          );
          allSymbols.push(stock.symbol);
          this.logger.debug(`Stock cacheado: ${stock.symbol}`);
        }

        this.logger.log(
          `Página ${pageCount} obtenida: ${data.items.length} items.`
        );

        if (!currentNextToken) {
          this.logger.log(
            `nextToken no encontrado en la respuesta de la página ${pageCount}. Asumiendo última página. Deteniendo paginación.`
          );
          break;
        }
        // También podemos salir si no hay items, incluso si por alguna razón nextToken no es nulo
        // (Aunque la ausencia de nextToken suele ser el indicador principal)
        if (data.items.length === 0) {
          this.logger.log(
            `Página ${pageCount} sin items. Deteniendo paginación.`
          );
          break;
        }
      } while (true);
    } catch (error) {
      this.logger.error(
        `Critical failure getting stocks from Vendor in _fetchAndCacheAllStocksFromVendor: ${error.message}`
      );
      throw error;
    }

    const uniqueSymbols = [...new Set(allSymbols)];
    await this.cacheManager.set(
      this.ALL_STOCKS_SYMBOLS_CACHE_KEY,
      uniqueSymbols,
      this.cacheTtlMilis
    );

    this.logger.log(
      `Global list of ${uniqueSymbols.length} stock symbols updated in cache.`
    );
  }

  /**
   * Aux method to get a stock from the cache
   */
  private async getOnlyCachedStock(
    symbol: string
  ): Promise<FuseStocksDataItem | undefined> {
    const cacheKey = `stock:${symbol}`;
    const cachedStock: FuseStocksDataItem | undefined =
      await this.cacheManager.get(cacheKey);
    return cachedStock;
  }
}
