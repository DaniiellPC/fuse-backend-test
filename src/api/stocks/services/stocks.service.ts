import { Injectable } from "@nestjs/common";
import { FuseService } from "../../../external/fuse/services/fuse.service";

@Injectable()
export class StocksService {
  constructor(private readonly fuseService: FuseService) {}

  async listStocks(page: number, limit: number) {
    page = Math.max(1, page);
    limit = Math.max(1, limit);
    return this.fuseService.getAllStocks(page, limit);
  }
}
