export type BuyFuseStockResponse = {
  status: number;
  message: string;
  data: BuyFuseStockData;
};

export type BuyFuseStockData = {
  order: BuyFuseStocksDataOrder;
};

export type BuyFuseStocksDataOrder = {
  symbol: string;
  quantity: number;
  price: number;
  total: number;
};
