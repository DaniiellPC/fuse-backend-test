import { HttpService } from "@nestjs/axios";
import { Headers, Injectable, Logger } from "@nestjs/common";
import { AxiosResponse } from "axios";
import { Observable } from "rxjs";
import { map, catchError } from "rxjs/operators";
import config from "../../../utils/config";
import { GetFuseStocks } from "../types/GetFuseStocks";

@Injectable()
export class FuseService {
  private readonly logger = new Logger(FuseService.name);

  constructor(private readonly httpService: HttpService) {}

  getFuseStocks(param?: string): Observable<GetFuseStocks> {
    const url = `${config().fuse.fuseBaseUrl}/stocks${
      param ? `?nextToken=${param}` : ""
    }`;
    this.logger.log(`Requesting data from FuseAPI: ${url}`);

    const options = {
      headers: {
        "x-api-key": config().fuse.fuseApiKey,
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
}
