import {
  Transaction,
  TransactionProperties,
} from "../../../../database/entities/transaction.entity";

export class BuyStockResponseDTO {
  public readonly transaction: TransactionProperties;

  static fromDomain(transaction: Transaction): BuyStockResponseDTO {
    const transactionProperties = transaction.getTransactionProperties();
    return {
      transaction: {
        ...transactionProperties,
      },
    };
  }
}
