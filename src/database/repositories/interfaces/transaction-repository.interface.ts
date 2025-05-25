import { Transaction } from "../../entities/transaction.entity";
import { EntityManager } from "typeorm";

export const TRANSACTION_REPOSITORY_TOKEN = "ITransactionRepository";

export interface ITransactionRepository {
  createAndSave(
    transactionData: Partial<Transaction>,
    manager?: EntityManager
  ): Promise<Transaction>;
  save(transaction: Transaction, manager?: EntityManager): Promise<Transaction>;
  findByDateRange(
    startDate: Date,
    endDate: Date,
    manager?: EntityManager
  ): Promise<Transaction[]>;
}
