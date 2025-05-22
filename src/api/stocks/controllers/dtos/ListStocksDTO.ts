import { IsString, IsOptional } from "@nestjs/class-validator";

export class ListStocksDTO {
  @IsString()
  @IsOptional()
  nextToken?: string;
}
