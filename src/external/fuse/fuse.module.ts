import { Module } from "@nestjs/common";
import { FuseService } from "./services/fuse.service";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [FuseService],
  exports: [FuseService],
})
export class FuseModule {}
