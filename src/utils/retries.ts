import { Logger } from "@nestjs/common";

export const retryOperation = async (
  operation: () => Promise<any>,
  maxRetries: number,
  delayMs: number,
  logger: Logger,
  context: string = "Operation"
): Promise<any> => {
  let attempts = 0;
  while (attempts < maxRetries) {
    try {
      return await operation();
    } catch (error) {
      attempts++;
      const nextDelay = delayMs * Math.pow(2, attempts - 1); // exponential backoff
      logger.warn(
        `${context} fails at try ${attempts}/${maxRetries}. Retrying in ${
          nextDelay / 1000
        }s...`,
        error.message ?? error
      );
      if (attempts < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, nextDelay));
      }
    }
  }
  logger.error(`${context} fails after ${maxRetries} tries.`);
  throw new Error(`${context} failed after ${maxRetries} attempts.`);
};
