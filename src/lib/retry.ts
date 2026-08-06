
/**
 * Utility function for retrying asynchronous operations with exponential backoff.
 * @param fn The function to retry.
 * @param options Retry options.
 * @returns The result of the function.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    backoffFactor?: number;
    onRetry?: (error: any, attempt: number) => void;
    retryCondition?: (error: any) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    backoffFactor = 2,
    onRetry,
    retryCondition = (error: any) => {
      // Retry on network errors or timeouts (standard fetch failure signatures)
      const message = error?.message?.toLowerCase() || "";
      return (
        message.includes("network") ||
        message.includes("timeout") ||
        message.includes("fetch") ||
        error?.name === "AbortError" ||
        error?.name === "TimeoutError"
      );
    },
  } = options;

  let lastError: any;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries && retryCondition(error)) {
        if (onRetry) {
          onRetry(error, attempt + 1);
        }
        
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= backoffFactor;
        continue;
      }
      
      throw error;
    }
  }

  throw lastError;
}
