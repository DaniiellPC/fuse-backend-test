import { FuseStocksDataDTO } from "./FuseStocksDataDTO";

export class GetFuseStocksDTO {
  public readonly status: number;
  public readonly data: FuseStocksDataDTO;

  static fromDomain(status: number, data: any): GetFuseStocksDTO {
    return {
      status,
      data: FuseStocksDataDTO.fromDomain(data),
    };
  }
}
