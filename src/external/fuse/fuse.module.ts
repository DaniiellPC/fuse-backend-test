import { Module } from "@nestjs/common";
import { FuseService } from "./services/fuse.service";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { CacheModule } from "@nestjs/cache-manager";

@Module({
  imports: [HttpModule, ConfigModule, CacheModule],
  providers: [FuseService],
  exports: [FuseService],
})
export class FuseModule {}
