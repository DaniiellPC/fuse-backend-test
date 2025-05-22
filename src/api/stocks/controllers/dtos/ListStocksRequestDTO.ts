import { IsString, IsOptional } from "@nestjs/class-validator";

export class ListStocksRequestDTO {
  @IsString()
  @IsOptional()
  page?: string;

  @IsString()
  @IsOptional()
  limit?: string;
}
