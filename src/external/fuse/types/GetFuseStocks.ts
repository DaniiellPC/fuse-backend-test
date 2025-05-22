export type GetFuseStocks = {
  status: number;
  data: FuseStocksData;
};

export type FuseStocksData = {
  items: FuseStocksDataItems[];
  nextToken: string;
};

export type FuseStocksDataItems = {
  lastUpdate: Date;
  change: number;
  price: number;
  name: string;
  sector: string;
  symbol: string;
};
