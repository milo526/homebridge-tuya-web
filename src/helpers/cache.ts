import type { DeviceState } from "../api/response";
import { TUYA_DEVICE_TIMEOUT } from "../settings";
import type { Nullable } from "homebridge";

/**
 * Cache for device state with automatic expiration.
 * Reduces API calls by reusing recent state data.
 */
export class Cache {
  private value?: DeviceState;
  private validUntil = 0;

  /**
   * Check if the cache is still valid (not expired)
   */
  public get valid(): boolean {
    return (
      this.validUntil > Cache.getCurrentEpoch() && this.value !== undefined
    );
  }

  /**
   * Set the cached value and update expiration time
   */
  public set(data: DeviceState): void {
    this.validUntil = Cache.getCurrentEpoch() + TUYA_DEVICE_TIMEOUT + 5;
    this.merge(data);
  }

  /**
   * Renew the cache expiration time without changing the value
   */
  public renew(): void {
    const data = this.get(true);
    if (data) {
      this.set(data);
    }
  }

  /**
   * Merge new data into the cached value
   */
  public merge(data: DeviceState): void {
    this.value = { ...this.value, ...data };
  }

  /**
   * Get the cached value
   * @param always - return the cache even if cache is not valid
   */
  public get(always = false): Nullable<DeviceState> {
    if (!always && !this.valid) {
      return null;
    }

    return this.value ?? null;
  }

  /**
   * Clear the cache
   */
  public clear(): void {
    this.value = undefined;
    this.validUntil = 0;
  }

  /**
   * Get current epoch time in seconds
   */
  private static getCurrentEpoch(): number {
    return Math.ceil(new Date().getTime() / 1000);
  }
}
