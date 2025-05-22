import { HttpService } from "@nestjs/axios";
import {
  Headers,
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

@Injectable()
export class FuseService implements OnModuleInit {
  private readonly logger = new Logger(FuseService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly cacheTtlMilis: number;
  private readonly maxPagesToFetch: number;
  private readonly maxApiRetries: number;

  // Clave de caché para la lista completa de símbolos (para la "lectura" global)
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
  // Se ejecuta una vez que el módulo ha sido inicializado
  async onModuleInit() {
    this.logger.log(
      "VendorService inicializado. Realizando carga inicial de stocks."
    );
    await this.fetchAndCacheAllStocksFromVendor();
  }

  /**
   * Cron job para actualizar periódicamente la caché de stocks.
   * Se ejecuta cada 5 minutos.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  private async handleCronStockRefresh() {
    this.logger.log(`[Cron Job] Iniciando actualización programada de stocks.`);
    await this.fetchAndCacheAllStocksFromVendor();
    this.logger.log(`[Cron Job] Actualización de stocks completada.`);
  }

  /**
   * MÉTODO PRIVADO: Responsable de ir al Vendor, obtener todas las páginas
   * y popular/actualizar la caché individual de stocks.
   * También actualiza la clave de caché para la lista completa de símbolos.
   */
  private async fetchAndCacheAllStocksFromVendor(): Promise<void> {
    this.logger.log(
      "Iniciando _fetchAndCacheAllStocksFromVendor: Obteniendo datos frescos del Vendor."
    );
    let allSymbols: string[] = []; // Para guardar solo los símbolos
    let currentNextToken: string | undefined = undefined;
    let pageCount = 0;

    try {
      do {
        pageCount++;
        if (pageCount > this.maxPagesToFetch) {
          this.logger.warn(
            `Límite de ${this.maxPagesToFetch} páginas alcanzado en _fetchAndCacheAllStocksFromVendor. Deteniendo paginación.`
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
        `Fallo crítico al obtener stocks del Vendor en _fetchAndCacheAllStocksFromVendor: ${error.message}`
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
      `Lista global de ${uniqueSymbols.length} símbolos de stocks actualizada en caché.`
    );
  }

  /**
   * MÉTODO PÚBLICO: Obtiene una página de stocks disponibles.
   * Prioriza la lectura de la caché. Si la caché está vacía o expirada,
   * dispara la obtención de datos frescos del vendor y actualiza la caché.
   *
   * @param page El número de página a recuperar (por defecto 1).
   * @param limit El número máximo de ítems por página (por defecto 10).
   * @returns Una promesa que resuelve con un objeto PaginatedStocksResponse.
   */
  async getAllStocks(
    page: number,
    limit: number
  ): Promise<PaginatedListFuseStocks> {
    this.logger.log(
      `Solicitud para obtener stocks (Página: ${page}, Límite: ${limit}). Intentando leer de caché.`
    );

    let allSymbols: string[] | undefined = await this.cacheManager.get(
      this.ALL_STOCKS_SYMBOLS_CACHE_KEY
    );

    // Si la caché está vacía o expirada, forzar una actualización completa
    if (!allSymbols || allSymbols.length === 0) {
      this.logger.warn(
        "Caché de símbolos vacía o expirada. Forzando actualización desde el Vendor."
      );
      try {
        await this.fetchAndCacheAllStocksFromVendor();
        allSymbols = await this.cacheManager.get(
          this.ALL_STOCKS_SYMBOLS_CACHE_KEY
        ); // Re-leer después de la actualización
        if (!allSymbols || allSymbols.length === 0) {
          this.logger.error(
            "No se pudieron obtener símbolos de stocks ni siquiera después de la actualización del Vendor."
          );
          throw new HttpException(
            "No se pudieron obtener stocks disponibles.",
            HttpStatus.SERVICE_UNAVAILABLE
          );
        }
      } catch (error) {
        this.logger.error(
          `Error al forzar actualización y obtener símbolos de stocks: ${error.message}`
        );
        throw error;
      }
    }

    const totalStocks = allSymbols.length;
    const totalPages = Math.ceil(totalStocks / limit);

    // Ajustar la página si el número es demasiado alto
    if (page > totalPages && totalPages > 0) {
      page = totalPages;
    } else if (totalPages === 0) {
      page = 1; // Si no hay stocks, la página es 1
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
        // Esto podría pasar si un stock individual expiró antes que la lista global,
        // o si hubo un error al cachear un stock específico.
        // Para "production-ready", esto podría disparar una alerta o un re-fetch específico.
        this.logger.warn(
          `Stock individual ${symbol} no encontrado en caché para la página actual.`
        );
      }
    }

    this.logger.log(
      `Retornando ${paginatedItems.length} stocks para la página ${page} de ${totalPages} (Total: ${totalStocks}).`
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
   * Obtiene un stock específico por su símbolo, buscando primero en la caché.
   * Si no está en caché o expirado, dispara una actualización completa (via _fetchAndCacheAllStocksFromVendor).
   */
  async getStockBySymbol(symbol: string): Promise<FuseStocksDataItem | null> {
    const cacheKey = `stock:${symbol}`;
    const cachedStock: FuseStocksDataItem | undefined =
      await this.cacheManager.get(cacheKey);

    if (cachedStock) {
      this.logger.log(`Stock ${symbol} obtenido de la caché.`);
      return cachedStock;
    }

    this.logger.warn(
      `Stock ${symbol} no encontrado en caché o expirado. Intentando actualizar caché global.`
    );

    try {
      await this.fetchAndCacheAllStocksFromVendor();
      const foundStock: FuseStocksDataItem | undefined =
        await this.cacheManager.get(cacheKey);
      if (foundStock) {
        this.logger.log(
          `Stock ${symbol} encontrado y cacheado después de una actualización forzada.`
        );
        return foundStock;
      } else {
        this.logger.warn(
          `Stock ${symbol} no encontrado en la respuesta del Vendor después de la actualización.`
        );
        return null;
      }
    } catch (error) {
      this.logger.error(
        `Fallo al intentar obtener y cachear stocks para encontrar ${symbol}: ${error.message}`
      );
      return null;
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
        "x-api-key": this.baseUrl,
      },
    };

    const body: BuyFuseStockRequest = {
      price,
      quantity,
    };

    return this.httpService.post(url, body, options).pipe(
      map((response: AxiosResponse) => response.data),
      catchError((error) => {
        this.logger.error("Error sending data from FuseAPI", error);
        throw error;
      })
    );
  }
}
