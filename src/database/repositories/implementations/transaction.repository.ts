import { Injectable } from "@nestjs/common";
import { Between, DataSource, EntityManager, Repository } from "typeorm";
import { Transaction } from "../../entities/transaction.entity";
import { ITransactionRepository } from "../interfaces/transaction-repository.interface";

@Injectable()
export class TransactionRepository implements ITransactionRepository {
  private readonly transactionRepo: Repository<Transaction>;

  constructor(private readonly dataSource: DataSource) {
    this.transactionRepo = this.dataSource.getRepository(Transaction);
  }

  async createAndSave(
    transactionData: Partial<Transaction>,
    manager?: EntityManager
  ): Promise<Transaction> {
    const repository = manager
      ? manager.getRepository(Transaction)
      : this.transactionRepo;
    const newTransaction = repository.create(transactionData);
    return repository.save(newTransaction);
  }

  async save(
    transaction: Transaction,
    manager?: EntityManager
  ): Promise<Transaction> {
    const repository = manager
      ? manager.getRepository(Transaction)
      : this.transactionRepo;
    return repository.save(transaction);
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    manager?: EntityManager
  ): Promise<Transaction[]> {
    const repository = manager
      ? manager.getRepository(Transaction)
      : this.transactionRepo;
    return repository.find({
      where: { created_at: Between(startDate, endDate) },
      order: { created_at: "ASC" },
    });
  }
}
