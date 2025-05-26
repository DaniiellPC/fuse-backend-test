// src/reports/reports.service.ts
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import * as nodemailer from "nodemailer";
import { generateCsv } from "../../utils/json2csv";
import * as luxon from "luxon";
import { ConfigService } from "@nestjs/config";
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY_TOKEN,
} from "../../database/repositories/interfaces/transaction-repository.interface";
import { retryOperation } from "../../utils/retries";

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly emailHost: string;
  private readonly emailPort: number;
  private readonly emailUser: string;
  private readonly emailPass: string;
  private readonly smtpSecure: boolean;
  private readonly maxEmailRetries: number;
  private readonly emailRetryDelay: number;

  constructor(
    @Inject(TRANSACTION_REPOSITORY_TOKEN)
    private readonly transactionsRepository: ITransactionRepository,
    private readonly configService: ConfigService
  ) {
    this.emailHost = this.configService.get<string>("mailtrap.host");
    this.emailPort = this.configService.get<number>("mailtrap.port");
    this.emailUser = this.configService.get<string>("mailtrap.user");
    this.emailPass = this.configService.get<string>("mailtrap.pass");
    this.smtpSecure = this.configService.get<boolean>("mailtrap.secure");
    this.maxEmailRetries = this.configService.get<number>(
      "mailtrap.maxEmailRetries"
    );
    this.emailRetryDelay = this.configService.get<number>(
      "mailtrap.emailRetryDelay"
    );
  }

  /**
   * Generates and sends a daily transactions report via email.
   * This method is scheduled to run every minute for testing purposes.
   * In production, it should be set to run once a day.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleHourlyReport() {
    this.logger.log(
      "Attempting to generate and send hourly transactions report..."
    );

    const now = luxon.DateTime.now().setZone("America/New_York");

    const startOfDay = now.startOf("day").toJSDate();
    const endOfDay = now.endOf("day").toJSDate();

    try {
      const transactions = await this.transactionsRepository.findByDateRange(
        startOfDay,
        endOfDay
      );

      if (transactions.length === 0) {
        this.logger.log("No transactions found for today. Skipping email.");
        return;
      }

      const fields = Object.keys(transactions[0] || {});
      if (fields.length === 0) {
        this.logger.warn("No fields found for CSV generation. Skipping.");
        return;
      }

      const csv = generateCsv(transactions);

      const transporter = nodemailer.createTransport({
        host: this.emailHost,
        port: this.emailPort,
        secure: this.smtpSecure,
        auth: {
          user: this.emailUser,
          pass: this.emailPass,
        },
      });

      const mailOptions = {
        from: '"Transactions Reports" <reports@your-app.com>',
        to: "email_test@example.com",
        subject: `Daily Transactions Report - ${now.toFormat("MM-dd-yyyy")}`,
        html: `<p>Hey,</p>
                <p>Attached you will find the transactions report for the day ${now.toFormat(
                  "MM-dd-yyyy"
                )}.</p>
               <p>Greetings,</p>
               <p>NestJS Fuse Test</p>`,
        attachments: [
          {
            filename: `transactions_${now.toFormat("MM-dd-yyyy")}.csv`,
            content: csv,
            contentType: "text/csv",
          },
        ],
      };

      await retryOperation(
        async () => await transporter.sendMail(mailOptions),
        this.maxEmailRetries,
        this.emailRetryDelay,
        this.logger,
        "Email sending"
      );

      this.logger.log("Email with report sended to MailTrap.IO sucessfully!");
    } catch (error) {
      this.logger.error("Error generating or sending report", error.stack);
    }
  }
}
