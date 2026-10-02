import { RateLimiterMemory } from "rate-limiter-flexible";

const requestsPerMinute = Number(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || 60);

export function createLimiter(points: number = requestsPerMinute, durationSeconds: number = 60) {
  const limiter = new RateLimiterMemory({ points, duration: durationSeconds });
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    await limiter.consume(1);
    return fn();
  };
}

