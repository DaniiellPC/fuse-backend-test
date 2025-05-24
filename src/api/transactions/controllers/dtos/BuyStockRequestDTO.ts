import { Type } from "class-transformer";
import {
  IsString,
  IsNumber,
  IsInt,
  Min,
  IsUUID,
  IsNotEmpty,
} from "class-validator";

export class BuyStockRequestDTO {
  @IsUUID("4")
  @IsString()
  @IsNotEmpty({ message: "userId cannot be empty." })
  userId: string;

  @IsString()
  @IsNotEmpty({ message: "symbol cannot be empty." })
  symbol: string;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: "Price must be a number with up to two decimal places." }
  )
  price: number;

  @Type(() => Number)
  @IsInt({ message: "Quantity must be an integer." })
  @Min(1, { message: "Quantity must be at least 1." })
  quantity: number;
}
