import {
  Transaction,
  TransactionProperties,
} from "../../../../database/entities/transaction.entity";

export class BuyStockResponseDTO {
  public readonly transaction: TransactionProperties;

  static fromDomain(transaction: Transaction): BuyStockResponseDTO {
    const transactionProperties = transaction.getTransactionProperties();
    const totalAmount = Number(
      new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      }).format(transactionProperties.total_amount)
    );

    return {
      transaction: {
        id: transactionProperties.id,
        user_id: transactionProperties.user_id,
        stock_symbol: transactionProperties.stock_symbol,
        transaction_type: transactionProperties.transaction_type,
        quantity: transactionProperties.quantity,
        price_at_transaction: transactionProperties.price_at_transaction,
        total_amount: totalAmount,
        status: transactionProperties.status,
        message: transactionProperties.message,
        transaction_date: transactionProperties.transaction_date,
        completion_date: transactionProperties.completion_date,
        created_at: transactionProperties.created_at,
        updated_at: transactionProperties.updated_at,
      },
    };
  }
}
