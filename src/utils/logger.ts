import { Logger as PinoLogger } from "pino";
import { Injectable } from "@nestjs/common";

@Injectable()
export class Logger {
  constructor(private readonly logger: PinoLogger) {}

  info(message: string, ...args: any[]) {
    this.logger.info(message, ...args);
  }

  warn(message: string, ...args: any[]) {
    this.logger.warn(message, ...args);
  }

  error(message: string, ...args: any[]) {
    this.logger.error(message, ...args);
  }
}
