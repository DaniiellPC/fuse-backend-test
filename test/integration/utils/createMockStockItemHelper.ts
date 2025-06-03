import { FuseStocksDataItem } from "../../../src/external/fuse/types/GetFuseStocksResponse";

// Helper to create mock stock items
export const createMockStockItem = (
  symbol: string,
  name: string,
  price: number,
  lastUpdate: Date = new Date(),
  change: number = 0.5,
  sector: string = "Technology"
): FuseStocksDataItem => ({
  symbol,
  name,
  price,
  lastUpdate,
  change,
  sector,
});
