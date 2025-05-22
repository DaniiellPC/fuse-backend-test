export type FuseStocksDataItems = {
  lastUpdate: Date;
  change: number;
  price: number;
  name: string;
  sector: string;
  symbol: string;
};

export class StocksItemsDTO {
  public readonly lastUpdate: Date;
  public readonly change: number;
  public readonly price: number;
  public readonly name: string;
  public readonly sector: string;
  public readonly symbol: string;

  static fromDomain(items: FuseStocksDataItems): StocksItemsDTO {
    return {
      lastUpdate: items.lastUpdate,
      change: items.change,
      price: items.price,
      name: items.name,
      sector: items.sector,
      symbol: items.symbol,
    };
  }
}
