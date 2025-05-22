import { Injectable } from "@nestjs/common";
import { FuseService } from "../../../external/fuse/services/fuse.service";

@Injectable()
export class StocksService {
  constructor(private readonly fuseService: FuseService) {}

  async execute(query?: string) {
    return this.fuseService.getFuseStocks(query);
  }
}
