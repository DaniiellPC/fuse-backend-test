// src/reports/reports.module.ts
import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ReportsService } from "../reports/services/reports.service";
import { RepositoryModule } from "../database/repositories/repository.module";

@Module({
  imports: [ScheduleModule.forRoot(), RepositoryModule],
  providers: [ReportsService],
})
export class ReportsModule {}
