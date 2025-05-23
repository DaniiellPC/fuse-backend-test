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
import {
  IPortfolioRepository,
  PORTFOLIO_REPOSITORY_TOKEN,
} from "../../../database/repositories/interfaces/portfolio-repository.interface";

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
    @Inject(PORTFOLIO_REPOSITORY_TOKEN)
    private readonly portfolioRepository: IPortfolioRepository
  ) {}

  async buyStock(body: BuyStockRequestDTO) {
    const { symbol, price, quantity, userId } = body;
    const totalCost = quantity * price;
    const transactionRecord = Transaction.create({
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

    try {
      const initialUser = await this.userRepository.findOneById(userId);

      if (!initialUser) {
        transactionRecord.updateStatus(TransactionStatus.FAILED);
        transactionRecord.setMessage("User Not Found");
        await this.transactionRepository.createAndSave(transactionRecord);
        throw new HttpException("User Not Found", HttpStatus.NOT_FOUND);
      }

      if (initialUser.balance < totalCost) {
        this.logger.warn(
          `Purchase failed for user ${userId}: insufficient balance (pre-validation). Cost: ${totalCost}, Balance: ${initialUser.balance}`
        );
        transactionRecord.updateStatus(TransactionStatus.FAILED);

        transactionRecord.setMessage("Insufficient Funds");
        await this.transactionRepository.createAndSave(transactionRecord);
        throw new HttpException("Insufficient Funds", HttpStatus.BAD_REQUEST);
      }

      await this.fuseService.processExternalPurchase(
        symbol,
        quantity,
        price,
        transactionRecord
      );

      await this.dataSource.transaction(async (manager: EntityManager) => {
        const user = await this.userRepository.findOneByIdWithLock(userId);
        if (!user) {
          //this shouldn't happen, but just in case
          transactionRecord.updateStatus(TransactionStatus.FAILED);
          transactionRecord.setMessage("User Not Found In Transaction");
          throw new HttpException(
            "Usuario no encontrado en transacción.",
            HttpStatus.NOT_FOUND
          );
        }

        // Re-verification of balance after acquiring the lock
        if (user.balance < totalCost) {
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

        // Deduct from the user's balance
        user.balance = parseFloat((user.balance - totalCost).toFixed(4));
        await this.userRepository.save(user, manager);
        this.logger.log(`User ${userId} balance updated to ${user.balance}`);

        await this.upsertPortfolio(
          userId,
          symbol,
          quantity,
          price,
          totalCost,
          manager
        );
      });
    } catch (error) {
      // This main catch block captures *all* errors (validations, external API, DB).
      this.logger.error(
        `General error for user ${userId}: ${error.message}`,
        error.stack
      );

      // If transactionRecord has not been created for some extreme reason, or does not have an ID,
      // this could fail. But given the flow, it should always exist here.
      // Ensure that the transaction is marked as FAILED if it wasn't already.
      if (
        transactionRecord &&
        transactionRecord.getStatus() !== TransactionStatus.COMPLETED
      ) {
        transactionRecord.updateStatus(TransactionStatus.FAILED);
        transactionRecord.setMessage(
          transactionRecord.getMessage() || `Unexpected error: ${error.message}`
        );
      }

      throw error;
    } finally {
      // --- Final Step: Save the transaction with its final status ---
      // If the transaction was already saved as COMPLETED inside the DB block,
      // this call will be a no-op update or a re-save of the same status.
      // If there was an error and the transaction was marked as FAILED, it will be persisted here.
      await this.transactionRepository.save(transactionRecord);
      this.logger.log(
        `Final transaction persisted in DB for user ${userId}. ID: ${
          transactionRecord.id
        }. Status: ${transactionRecord.getStatus()}`
      );
    }

    const isPriceValid = await this.fuseService.compareStockPrice(
      symbol,
      price
    );
    if (!isPriceValid) {
      throw new HttpException(
        "The price was not correct",
        HttpStatus.BAD_REQUEST
      );
    }
    return this.fuseService.buyFuseStock(symbol, price, quantity);
  }

  private async upsertPortfolio(
    userId: string,
    stockSymbol: string,
    quantity: number,
    clientPrice: number,
    totalCost: number,
    manager: EntityManager
  ): Promise<void> {
    let portfolioItem = await this.portfolioRepository.findOneByUserIdAndSymbol(
      userId,
      stockSymbol,
      manager
    );

    if (portfolioItem) {
      const currentTotalValue =
        portfolioItem.quantity * portfolioItem.average_buy_price;
      const newTotalValue = currentTotalValue + totalCost;
      const newQuantity = portfolioItem.quantity + quantity;

      portfolioItem.quantity = newQuantity;
      portfolioItem.average_buy_price = parseFloat(
        (newTotalValue / newQuantity).toFixed(4)
      );
      this.logger.log(
        `Portafolio actualizado para usuario ${userId}, stock ${stockSymbol}. Nueva cantidad: ${portfolioItem.quantity}, Precio promedio: ${portfolioItem.average_buy_price}`
      );
    } else {
      portfolioItem = this.portfolioRepository.create(
        {
          user_id: userId,
          stock_symbol: stockSymbol,
          quantity: quantity,
          average_buy_price: clientPrice,
        },
        manager
      );
      this.logger.log(
        `Nueva entrada de portafolio creada para usuario ${userId}, stock ${stockSymbol}. Cantidad: ${portfolioItem.quantity}`
      );
    }
    await this.portfolioRepository.save(portfolioItem, manager);
  }
}
