import {
  IsString,
  IsNumber,
  IsInt,
  Min,
  Matches,
} from "@nestjs/class-validator";

export class BuyStockRequestDTO {
  @IsString()
  symbol: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: "Price must be a number with up to two decimal places." }
  )
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: "Price can have up to two decimal places.",
  })
  price: number;

  @IsInt({ message: "Quantity must be an integer." })
  @Min(1, { message: "Quantity must be at least 1." })
  quantity: number;
}
