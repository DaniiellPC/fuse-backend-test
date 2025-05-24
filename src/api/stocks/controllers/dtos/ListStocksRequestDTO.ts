import { IsString, IsOptional } from "class-validator";

export class ListStocksRequestDTO {
  @IsString()
  @IsOptional()
  page?: string;

  @IsString()
  @IsOptional()
  limit?: string;
}
