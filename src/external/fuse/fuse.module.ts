import { Module } from "@nestjs/common";
import { FuseController } from "./controllers/fuse.controller";
import { FuseService } from "./services/fuse.service";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [FuseController],
  providers: [FuseService],
  exports: [FuseService],
})
export class FuseModule {}
