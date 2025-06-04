import { IsInt, IsOptional, Min, IsNumber } from "class-validator";
import { Type } from "class-transformer";

export class ListStocksRequestDTO {
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: "Page must be a valid number" }
  )
  @IsInt({ message: "Page must be an integer number" })
  @Min(1, { message: "Page must be at least 1" })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: "Limit must be a valid number" }
  )
  @IsInt({ message: "Limit must be an integer number" })
  @Min(1, { message: "Limit must be at least 1" })
  limit: number = 10;
}
