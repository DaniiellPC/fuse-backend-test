export type GetFuseStocksResponse = {
  status: number;
  data: FuseStocksData;
};

export type FuseStocksData = {
  items: FuseStocksDataItem[];
  nextToken: string;
};

export type FuseStocksDataItem = {
  lastUpdate: Date;
  change: number;
  price: number;
  name: string;
  sector: string;
  symbol: string;
};
