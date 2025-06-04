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
    @Inject(CACHE_MANAGER) private cacheManager: Cache
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
      "VendorService initialized. Performing initial stock loading. (onModuleInit)"
    );
    await this.fetchAndCacheAllStocksFromVendor();
    this.logger.log("Initial stock loading completed. (onModuleInit)");
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

    const cachedSymbolsBeforeAttempt: string[] | undefined =
      await this.cacheManager.get(this.ALL_STOCKS_SYMBOLS_CACHE_KEY);
    this.logger.log(
      `[getAllStocks] Cache state for ${
        this.ALL_STOCKS_SYMBOLS_CACHE_KEY
      } BEFORE conditional fetch: ${JSON.stringify(
        cachedSymbolsBeforeAttempt
      )} (Type: ${typeof cachedSymbolsBeforeAttempt})`
    );

    let allSymbols: string[] | undefined = await this.cacheManager.get(
      this.ALL_STOCKS_SYMBOLS_CACHE_KEY
    );

    // If cache is truly empty (key not found or value is null/undefined),
    // then force an update from the vendor.
    // An existing empty array in the cache is a valid state from a previous successful fetch.
    if (allSymbols === undefined || allSymbols === null) {
      this.logger.warn(
        "Cache of symbols is uninitialized (undefined/null). Forcing update from Vendor."
      );
      try {
        await this.fetchAndCacheAllStocksFromVendor();
        allSymbols = await this.cacheManager.get(
          this.ALL_STOCKS_SYMBOLS_CACHE_KEY
        ); // Re-read after update

        // After attempting to fetch, if allSymbols is still undefined or null,
        // it indicates a failure to populate the cache.
        if (allSymbols === undefined || allSymbols === null) {
          this.logger.error(
            "Stock symbols cache remains uninitialized even after attempting Vendor update."
          );
          throw new HttpException(
            "Could not initialize stock symbols from vendor.", // More accurate message
            HttpStatus.SERVICE_UNAVAILABLE
          );
        }
        // If allSymbols is an empty array [], this is a valid state (vendor returned no stocks).
        // The service will then proceed to return a paginated list with 0 items.
        this.logger.log(
          `Successfully updated symbols cache from vendor. Current symbol count: ${allSymbols.length}`
        );
      } catch (error) {
        // This catches errors from fetchAndCacheAllStocksFromVendor
        this.logger.error(
          `Failed to update symbols from vendor: ${error.message}`,
          error.stack
        );
        throw new HttpException(
          "Could not get available stocks.",
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }
    }

    // At this point, allSymbols should be an array (possibly empty).
    // If it were undefined/null, an error would have been thrown in the block above.
    // Adding a safeguard, though this state should ideally not be reached.
    if (allSymbols === undefined || allSymbols === null) {
      this.logger.error(
        "Critical: allSymbols is unexpectedly null/undefined before pagination logic."
      );
      throw new HttpException(
        "Internal error processing stock symbols.",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
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
      `Starting comparison for stock: ${symbol} with client price: ${clientPrice}`
    );

    // Tries to get the stock from the cache
    const cachedStock = await this.getOnlyCachedStock(symbol);

    if (!cachedStock) {
      this.logger.warn(
        `Stock ${symbol} not found in cache. Cannot perform price validation.`
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
        `The cached price (${cachedPrice}) for '${symbol}' is within 2% of the client price (${clientPrice}).`
      );
      return true;
    } else {
      const difference = Math.abs(cachedPrice - clientPrice);
      const priceDifferencePercentage = (difference / clientPrice) * 100;
      this.logger.log(
        `The cached price (${cachedPrice}) for '${symbol}' is OUTSIDE the 2% range of the client price (${clientPrice}). Difference: ${priceDifferencePercentage.toFixed(
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

      // Verifying the response
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
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      this.logger.log(
        `Purchase confirmed by FuseAPI for user ${transactionRecord.getUserId()}, stock ${stockSymbol}. Order ID: ${
          apiResponse.data.order.symbol
        }`
      );

      transactionRecord.setMessage(
        "Order confirmed by external provider, pending database registration."
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
    this.logger.log(`Sending data to FuseAPI: ${url}`);

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
        // Log a summary instead of the full AxiosError object for expected failures
        if (error.isAxiosError) {
          this.logger.warn(
            `FuseAPI request to ${error.config?.url} failed: ${error.response?.status} - ${error.message}`
          );
        } else {
          this.logger.error("Error sending data to FuseAPI (non-Axios)", error);
        }
        throw new HttpException(
          `Error connecting to external provider: ${error.message}`,
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
      "Starting fetchAndCacheAllStocksFromVendor: Getting fresh data from Vendor."
    );
    let allSymbolsLocal: string[] = []; // To store only the symbols for the current fetch operation
    let currentNextToken: string | undefined = undefined;
    let pageCount = 0;

    try {
      do {
        pageCount++;
        if (pageCount > this.maxPagesToFetch) {
          this.logger.warn(
            `Limit of ${this.maxPagesToFetch} pages reached in fetchAndCacheAllStocksFromVendor. Stopping pagination.`
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
                  `Error fetching stocks from Vendor (Page ${pageCount}) in fetchAndCacheAllStocksFromVendor: ${error.message}`,
                  error.stack
                );
                throw new HttpException(
                  "Failed to connect to the vendor's stock service.",
                  HttpStatus.SERVICE_UNAVAILABLE
                );
              })
            )
          );

        const data = response.data.data;
        if (!data || !data.items) {
          this.logger.warn(
            `Vendor did not return data or items on page ${pageCount} in fetchAndCacheAllStocksFromVendor.`
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
          allSymbolsLocal.push(stock.symbol); // Use local variable for this fetch
          this.logger.debug(`Cached stock: ${stock.symbol}`);
        }

        this.logger.log(
          `Page ${pageCount} gotten: ${data.items.length} items.`
        );

        if (!currentNextToken) {
          this.logger.log(
            `nextToken not found in the response of page ${pageCount}. Assuming last page. Stopping pagination.`
          );
          break;
        }
        // We can also exit if there are no items, even if for some reason nextToken is not null
        // (Although the absence of nextToken is usually the main indicator)
        if (data.items.length === 0) {
          this.logger.log(
            `Page ${pageCount} has no items. Stopping pagination.`
          );
          break;
        }
      } while (true);
    } catch (error) {
      this.logger.error(
        `Critical failure getting stocks from Vendor in fetchAndCacheAllStocksFromVendor: ${error.message}`
      );
      throw error;
    }

    const uniqueSymbols = [...new Set(allSymbolsLocal)]; // Use local variable
    this.logger.log(
      `[fetchAndCacheAllStocksFromVendor] Attempting to set ${
        this.ALL_STOCKS_SYMBOLS_CACHE_KEY
      } in cache with ${uniqueSymbols.length} symbols: ${JSON.stringify(
        uniqueSymbols
      )}`
    );
    await this.cacheManager.set(
      this.ALL_STOCKS_SYMBOLS_CACHE_KEY,
      uniqueSymbols,
      this.cacheTtlMilis
    );
    const afterSetCheck: string[] | undefined = await this.cacheManager.get(
      this.ALL_STOCKS_SYMBOLS_CACHE_KEY
    );
    this.logger.log(
      `[fetchAndCacheAllStocksFromVendor] Cache state for ${
        this.ALL_STOCKS_SYMBOLS_CACHE_KEY
      } AFTER set: ${JSON.stringify(afterSetCheck)}`
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
