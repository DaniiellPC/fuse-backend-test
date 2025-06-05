import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, Logger, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import * as luxon from "luxon";
import { v4 as uuidv4 } from "uuid";
import * as nodemailer from "nodemailer";
import {
  mockCreateTransportImpl,
  mockSendMail,
  resetMailtrapMocks,
} from "./mailtrap.mock";

import { ReportsModule } from "../../../src/reports/reports.module";
import { ReportsService } from "../../../src/reports/services/reports.service";
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from "../../../src/database/entities/transaction.entity";
import { User } from "../../../src/database/entities/user.entity";
import { Portfolio } from "../../../src/database/entities/portfolio.entity";
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY_TOKEN,
} from "../../../src/database/repositories/interfaces/transaction-repository.interface";
import { clearDatabase, seedDatabase } from "../utils/test-database";

// Mock nodemailer
jest.mock("nodemailer");

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        () => ({
          mailtrap: {
            host: "smtp.mailtrap.io",
            port: 2525,
            user: "testuser",
            pass: "testpass",
            secure: false,
            maxEmailRetries: 3,
            emailRetryDelay: 100, // ms for faster tests
          },
          database: {
            host: process.env.DATABASE_HOST,
            port: parseInt(process.env.DATABASE_PORT || "5432", 10),
            username: process.env.DATABASE_USERNAME,
            password: process.env.DATABASE_PASSWORD,
            name: process.env.DATABASE_NAME,
            ssl: process.env.DB_SSL === "true",
          },
        }),
      ],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        host: configService.get<string>("database.host"),
        port: configService.get<number>("database.port"),
        username: configService.get<string>("database.username"),
        password: configService.get<string>("database.password"),
        database: configService.get<string>("database.name"),
        entities: [User, Transaction, Portfolio],
        migrations: ["dist/src/database/migrations/*.js"],
        migrationsRun: false,
        synchronize: false,
        autoLoadEntities: false,
        logging: false,
        ssl: configService.get<boolean>("database.ssl")
          ? { rejectUnauthorized: false }
          : false,
      }),
      inject: [ConfigService],
    }),
    ReportsModule,
    ScheduleModule.forRoot(),
  ],
})
class MinimalReportsTestModule {}

describe("ReportsService (Integration)", () => {
  let app: INestApplication;
  let reportsService: ReportsService;
  let transactionRepository: ITransactionRepository;
  let dataSource: DataSource;
  let loggerSpyLog: jest.SpyInstance;
  let loggerSpyError: jest.SpyInstance;
  let loggerSpyWarn: jest.SpyInstance;

  const today = luxon.DateTime.now().setZone("America/New_York");

  async function createTransaction(data: Partial<Transaction>) {
    let userIdToUse = data.user_id;

    // If no user_id is provided, create a dummy user
    if (!userIdToUse) {
      if (!dataSource) {
        // This should ideally not happen if beforeAll has run successfully
        throw new Error(
          "DataSource is not initialized in createTransaction helper."
        );
      }
      const userRepo = dataSource.getRepository(User);
      const newUser = userRepo.create({
        id: uuidv4(),
        username: `testuser_${uuidv4().substring(0, 8)}`,
        email: `dummy_${uuidv4().substring(0, 8)}@example.com`,
        password_hash: "testpasswordplaceholder",
      });
      const savedUser = await userRepo.save(newUser);
      userIdToUse = savedUser.id;
    }

    return transactionRepository.createAndSave({
      id: data.id || uuidv4(),
      user_id: userIdToUse,
      stock_symbol: data.stock_symbol || "TEST",
      transaction_type: data.transaction_type || TransactionType.BUY,
      quantity: data.quantity || 1,
      price_at_transaction: data.price_at_transaction || 100,
      total_amount: data.total_amount || 100,
      status: data.status || TransactionStatus.COMPLETED,
      created_at: data.created_at || new Date(),
      ...data,
    });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MinimalReportsTestModule],
    }).compile();

    app = moduleFixture.createNestApplication({ logger: false });
    await app.init();

    reportsService = moduleFixture.get<ReportsService>(ReportsService);
    transactionRepository = moduleFixture.get<ITransactionRepository>(
      TRANSACTION_REPOSITORY_TOKEN
    );
    dataSource = moduleFixture.get<DataSource>(DataSource);

    loggerSpyLog = jest.spyOn(Logger.prototype, "log");
    loggerSpyError = jest.spyOn(Logger.prototype, "error");
    loggerSpyWarn = jest.spyOn(Logger.prototype, "warn");

    (nodemailer.createTransport as jest.Mock).mockImplementation(
      mockCreateTransportImpl
    );
  });

  beforeEach(async () => {
    resetMailtrapMocks();
    loggerSpyLog.mockClear();
    loggerSpyError.mockClear();
    loggerSpyWarn.mockClear();

    if (app && dataSource?.isInitialized) {
      await clearDatabase(app);
      await seedDatabase(app);
    } else {
      console.warn(
        "Skipping DB clear/seed in beforeEach: app or dataSource not ready."
      );
    }
  });

  afterAll(async () => {
    loggerSpyLog.mockRestore();
    loggerSpyError.mockRestore();
    loggerSpyWarn.mockRestore();
    if (app) {
      await app.close();
    }
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  describe("handleHourlyReport", () => {
    it("should generate and send a report if transactions exist for the day", async () => {
      const userRepo = dataSource.getRepository(User);
      const testUser = await userRepo.save(
        userRepo.create({
          id: uuidv4(),
          username: "reportuser1",
          email: "reportuser1@example.com",
          password_hash: "testpassword",
        })
      );

      const transaction1 = await createTransaction({
        user_id: testUser.id,
        created_at: today.toJSDate(),
        stock_symbol: "AAPL",
        quantity: 10,
        price_at_transaction: 150,
        total_amount: 1500,
      });
      const transaction2 = await createTransaction({
        user_id: testUser.id,
        created_at: today.minus({ minutes: 1 }).toJSDate(),
        stock_symbol: "GOOG",
        quantity: 5,
        price_at_transaction: 2500,
        total_amount: 12500,
      });

      mockSendMail.mockResolvedValueOnce("Email sent successfully");

      await reportsService.handleHourlyReport();

      expect(loggerSpyLog).toHaveBeenCalledWith(
        "Attempting to generate and send hourly transactions report..."
      );
      expect(mockCreateTransportImpl).toHaveBeenCalled();
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe("email_test@example.com");
      expect(mailOptions.subject).toContain(
        `Daily Transactions Report - ${today.toFormat("MM-dd-yyyy")}`
      );
      expect(mailOptions.attachments[0].filename).toBe(
        `transactions_${today.toFormat("MM-dd-yyyy")}.csv`
      );
      const csvContent = mailOptions.attachments[0].content;
      expect(csvContent).toContain("id");
      expect(csvContent).toContain("user_id");
      expect(csvContent).toContain("stock_symbol");
      expect(csvContent).toContain(transaction1.id);
      expect(csvContent).toContain(testUser.id);
      expect(csvContent).toContain("AAPL");
      expect(csvContent).toContain(transaction2.id);
      expect(csvContent).toContain("GOOG");
      expect(loggerSpyLog).toHaveBeenCalledWith(
        "Email with report sended to MailTrap.IO successfully!"
      );
    });

    it("should log and skip email if no transactions are found for the day", async () => {
      await reportsService.handleHourlyReport();

      expect(loggerSpyLog).toHaveBeenCalledWith(
        "Attempting to generate and send hourly transactions report..."
      );
      expect(loggerSpyLog).toHaveBeenCalledWith(
        "No transactions found for today. Skipping email."
      );
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it("should log a warning and skip if transactions exist but have no fields (e.g., empty object)", async () => {
      const mockTransactionRepo = {
        findByDateRange: jest.fn().mockResolvedValueOnce([{}]),
        createAndSave: jest.fn(),
        save: jest.fn(),
      };

      const tempModule: TestingModule = await Test.createTestingModule({
        imports: [MinimalReportsTestModule],
      })
        .overrideProvider(TRANSACTION_REPOSITORY_TOKEN)
        .useValue(mockTransactionRepo)
        .compile();
      const tempApp = tempModule.createNestApplication({ logger: false });
      await tempApp.init();
      const tempReportsService = tempModule.get<ReportsService>(ReportsService);

      await tempReportsService.handleHourlyReport();

      expect(loggerSpyLog).toHaveBeenCalledWith(
        "Attempting to generate and send hourly transactions report..."
      );
      expect(mockTransactionRepo.findByDateRange).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date)
      );
      expect(loggerSpyWarn).toHaveBeenCalledWith(
        "No fields found for CSV generation. Skipping."
      );
      expect(mockSendMail).not.toHaveBeenCalled();
      await tempApp.close();
    });

    it("should retry sending email on failure and succeed", async () => {
      await createTransaction({ created_at: today.toJSDate() });

      mockSendMail
        .mockRejectedValueOnce(new Error("SMTP Error 1"))
        .mockRejectedValueOnce(new Error("SMTP Error 2"))
        .mockResolvedValueOnce("Email sent successfully on 3rd try");

      await reportsService.handleHourlyReport();

      expect(loggerSpyLog).toHaveBeenCalledWith(
        "Attempting to generate and send hourly transactions report..."
      );
      expect(mockSendMail).toHaveBeenCalledTimes(3);
      expect(loggerSpyWarn).toHaveBeenCalledWith(
        expect.stringContaining("Email sending fails at try 1/3. Retrying in"),
        "SMTP Error 1"
      );
      expect(loggerSpyWarn).toHaveBeenCalledWith(
        expect.stringContaining("Email sending fails at try 2/3. Retrying in"),
        "SMTP Error 2"
      );
      expect(loggerSpyLog).toHaveBeenCalledWith(
        "Email with report sended to MailTrap.IO successfully!"
      );
    });

    it("should log an error if email sending fails after all retries", async () => {
      // Define a reference date within the test to ensure transaction is found
      const referenceDateForTest =
        luxon.DateTime.now().setZone("America/New_York");
      await createTransaction({
        created_at: referenceDateForTest
          .set({ hour: 12, minute: 0, second: 0, millisecond: 0 })
          .toJSDate(),
      });

      mockSendMail
        .mockRejectedValueOnce(new Error("SMTP Fail 1"))
        .mockRejectedValueOnce(new Error("SMTP Fail 2"))
        .mockRejectedValueOnce(new Error("SMTP Fail 3 - final"));

      await reportsService.handleHourlyReport();

      expect(loggerSpyLog).toHaveBeenCalledWith(
        "Attempting to generate and send hourly transactions report..."
      );
      expect(loggerSpyLog).not.toHaveBeenCalledWith(
        "No transactions found for today. Skipping email."
      );
      expect(mockSendMail).toHaveBeenCalledTimes(3);
      expect(loggerSpyError).toHaveBeenCalledWith(
        "Error generating or sending report",
        expect.any(String)
      );
      expect(loggerSpyError).toHaveBeenCalledWith(
        "Email sending fails after 3 tries."
      );
    });
  });
});
