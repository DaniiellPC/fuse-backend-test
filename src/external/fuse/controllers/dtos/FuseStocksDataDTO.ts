import { FuseStocksDataItemsDTO } from "./FuseStocksDataItemsDTO";

export class FuseStocksDataDTO {
  public readonly items: FuseStocksDataItemsDTO[];
  public readonly nextToken: string;

  static fromDomain(data: any): FuseStocksDataDTO {
    return {
      items: data.items.map(FuseStocksDataItemsDTO.fromDomain),
      nextToken: data.nextToken,
    };
  }
}
