import { Module } from "@nestjs/common";
import { FuseController } from "./controllers/fuse.controller";
import { FuseService } from "./services/fuse.service";
import { HttpModule } from "@nestjs/axios";

@Module({
  imports: [HttpModule],
  controllers: [FuseController],
  providers: [FuseService],
  exports: [FuseService],
})
export class FuseModule {}
