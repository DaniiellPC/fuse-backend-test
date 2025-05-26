// src/reports/reports.module.ts
import { Module } from "@nestjs/common";
import { ReportsService } from "../reports/services/reports.service";
import { RepositoryModule } from "../database/repositories/repository.module";

@Module({
  imports: [RepositoryModule],
  providers: [ReportsService],
})
export class ReportsModule {}
