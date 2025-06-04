import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { FuseService } from "../../../external/fuse/services/fuse.service";
import { BuyStockRequestDTO } from "../controllers/dtos/BuyStockRequestDTO";
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from "../../../database/entities/transaction.entity";
import {
  IUserRepository,
  USER_REPOSITORY_TOKEN,
} from "../../../database/repositories/interfaces/user-repository.interface";
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY_TOKEN,
} from "../../../database/repositories/interfaces/transaction-repository.interface";
import { DataSource, EntityManager } from "typeorm";
import { PortfoliosService } from "../../portfolios/services/portfolios.service";

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly fuseService: FuseService,
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
    @Inject(TRANSACTION_REPOSITORY_TOKEN)
    private readonly transactionRepository: ITransactionRepository,
    private readonly portfoliosService: PortfoliosService
  ) {}

  async buyStock(body: BuyStockRequestDTO): Promise<Transaction> {
    const { symbol, price, quantity, userId } = body;
    let transactionRecord: Transaction | null = null;

    try {
      const initialUser = await this.userRepository.findOneById(userId);

      if (!initialUser) {
        this.logger.warn(
          `Attempt to buy stock for non-existent user: ${userId}`
        );
        throw new HttpException("User Not Found", HttpStatus.NOT_FOUND);
      }

      // User exists, now create the transaction record
      const totalCost = quantity * price;
      transactionRecord = Transaction.create({
        user_id: userId,
        stock_symbol: symbol,
        transaction_type: TransactionType.BUY,
        quantity,
        price_at_transaction: price,
        total_amount: totalCost,
        status: TransactionStatus.PENDING,
        created_at: new Date(),
        transaction_date: new Date(),
        message: "Purchase initiated, awaiting confirmation and validation",
      });

      if (initialUser.getBalance() < totalCost) {
        this.logger.warn(
          `Purchase failed for user ${userId}: insufficient balance (pre-validation). Cost: ${totalCost}, Balance: ${initialUser.getBalance()}`
        );
        transactionRecord.updateStatus(TransactionStatus.FAILED);
        transactionRecord.setMessage("Insufficient Funds");
        await this.transactionRepository.createAndSave(transactionRecord);
        throw new HttpException("Insufficient Funds", HttpStatus.BAD_REQUEST);
      }

      const isPriceValid = await this.fuseService.compareStockPrice(
        symbol,
        price
      );
      if (!isPriceValid) {
        this.logger.warn(
          `Purchase failed for user ${userId}: invalid stock price (${price}) for ${symbol}.`
        );
        transactionRecord.updateStatus(TransactionStatus.FAILED);
        transactionRecord.setMessage(
          "The purchase price is not correct or valid."
        );
        await this.transactionRepository.createAndSave(transactionRecord);
        throw new HttpException(
          "The purchase price is not correct or valid.",
          HttpStatus.BAD_REQUEST
        );
      }

      await this.fuseService.processExternalPurchase(
        symbol,
        quantity,
        price,
        transactionRecord
      );

      // If fuseService.processExternalPurchase updated transactionRecord to FAILED,
      // we should check its status before proceeding to the database transaction.
      if (transactionRecord.getStatus() === TransactionStatus.FAILED) {
        await this.transactionRepository.save(transactionRecord);
        throw new HttpException(
          transactionRecord.getMessage(),
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      await this.dataSource.transaction(async (manager: EntityManager) => {
        const user = await this.userRepository.findOneByIdWithLock(
          userId,
          manager
        );
        // User should exist due to the initial check, but re-verify in transaction
        if (!user) {
          transactionRecord.updateStatus(TransactionStatus.FAILED);
          transactionRecord.setMessage("User Not Found In Transaction");
          throw new HttpException(
            "User not found in transaction.",
            HttpStatus.NOT_FOUND
          );
        }

        if (user.getBalance() < totalCost) {
          transactionRecord.updateStatus(TransactionStatus.FAILED);
          transactionRecord.setMessage(
            "Race Condition: Insufficient Funds during purchase confirmation"
          );
          this.logger.warn(
            `Race condition detected for user ${userId}: insufficient funds after API call. TotalCost: ${totalCost}, Balance: ${user.balance}`
          );
          throw new HttpException(
            "Insufficient Funds due to high concurrency. Please try again.",
            HttpStatus.CONFLICT
          );
        }
        transactionRecord.updateStatus(TransactionStatus.COMPLETED);
        transactionRecord.setMessage(
          "Stock purchase successful and recorded in the database."
        );

        await this.transactionRepository.save(transactionRecord, manager);
        this.logger.log(
          `Buy transaction COMPLETED in DB for user ${userId}, stock ${symbol}. ID: ${transactionRecord.id}`
        );

        user.setBalance(parseFloat((user.getBalance() - totalCost).toFixed(4)));
        await this.userRepository.save(user, manager);
        this.logger.log(
          `User ${userId} balance updated to ${user.getBalance()}`
        );

        await this.portfoliosService.upsertPortfolio(
          userId,
          symbol,
          quantity,
          price,
          totalCost,
          manager
        );
      });

      // If dataSource.transaction committed, transactionRecord is COMPLETED and saved.
      return transactionRecord;
    } catch (error) {
      this.logger.error(
        `General error for user ${userId}: ${error.message}`,
        error.stack
      );

      // If the error is one we threw intentionally (like User Not Found, Insufficient Funds, Invalid Price)
      // and we've already saved the transaction as FAILED, or decided not to save (for User Not Found),
      // then just re-throw.
      if (error instanceof HttpException) {
        // If transactionRecord exists and was marked FAILED but not saved due to an error during saving,
        // this finally block might try to save it.
        // For "User Not Found", transactionRecord will be null, so finally block won't save.
        // For other HttpExceptions where transactionRecord was created and saved as FAILED, this is fine.
        throw error;
      }

      // For unexpected errors, if transactionRecord was created (meaning user was found)
      if (transactionRecord) {
        if (
          transactionRecord.getStatus() !== TransactionStatus.COMPLETED &&
          transactionRecord.getStatus() !== TransactionStatus.FAILED
        ) {
          transactionRecord.updateStatus(TransactionStatus.FAILED);
          transactionRecord.setMessage(
            `Unexpected error during processing: ${error.message}`
          );
        }
        // Attempt to save the final state if it hasn't been saved yet or if it's a new failure state.
        // This covers cases where an error occurred after transactionRecord was created but before it could be
        // definitively saved as COMPLETED or FAILED within the try block.
        // Ensure not to re-save if it was already persisted in a terminal state from within the try.
        // The transactionRepository.save should handle upsert logic or be idempotent for status updates.
        // However, if the error was, for example, a DB connection error during the main transaction block,
        // this save might also fail.
        try {
          await this.transactionRepository.save(transactionRecord);
          this.logger.log(
            `Transaction ${
              transactionRecord.id
            } for user ${userId} saved with status ${transactionRecord.getStatus()} in catch block.`
          );
        } catch (saveError) {
          this.logger.error(
            `Failed to save transaction ${transactionRecord.id} in catch block: ${saveError.message}`
          );
        }
      }
      throw error;
    }
  }
}
