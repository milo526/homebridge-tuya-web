/**
 * Error Types
 * 
 * Custom error classes for Tuya plugin.
 */

export { DeviceOfflineError } from './DeviceOfflineError';
export { RateLimitError } from './RateLimitError';

/**
 * Error callback type used by accessories
 */
export type ErrorCallback = (error: Error) => void;
