import { Controller, Get, Query } from "@nestjs/common";
import { FuseService } from "../services/fuse.service";
import { Observable } from "rxjs";

@Controller("fuse")
export class FuseController {
  constructor(private readonly fuseService: FuseService) {}

  @Get("stocks")
  getFuseStocks(@Query("param") param: string): Observable<any> {
    return this.fuseService.getFuseStocks(param);
  }

  // Add more endpoints as needed
}
