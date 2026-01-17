/**
 * RateLimitError
 * 
 * Thrown when the Tuya API rate limit has been exceeded.
 */
export class RateLimitError extends Error {
  constructor(message = 'Rate limit exceeded') {
    super(message);
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}
