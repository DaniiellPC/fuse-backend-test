export async function retryOperation<T>(
  operation: () => Promise<T>,
  shouldRetry: (error: any) => boolean,
  maxRetries = 5,
  delayMs = 300
): Promise<T> {
  let attempts = 0;
  while (attempts < maxRetries) {
    try {
      return await operation();
    } catch (error) {
      attempts++;
      if (attempts >= maxRetries || !shouldRetry(error)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error("Max retries reached");
}
