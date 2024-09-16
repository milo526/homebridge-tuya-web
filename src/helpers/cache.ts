import { DeviceState } from "../api/response";
import { TUYA_DEVICE_TIMEOUT } from "../settings";
import { Nullable } from "homebridge";

export class Cache {
  private value?: DeviceState;
  private validUntil = 0;

  public get valid(): boolean {
    return (
      this.validUntil > Cache.getCurrentEpoch() && this.value !== undefined
    );
  }

  public set(data: DeviceState): void {
    this.validUntil = Cache.getCurrentEpoch() + TUYA_DEVICE_TIMEOUT + 5;
    this.merge(data);
  }

  public renew() {
    const data = this.get(true);
    if (data) {
      this.set(data);
    }
  }

  public merge(data: DeviceState): void {
    this.value = { ...this.value, ...data };
  }

  /**
   *
   * @param always - return the cache even if cache is not valid
   */
  public get(always = false): Nullable<DeviceState> {
    if (!always && !this.valid) {
      return null;
    }

    return this.value ?? null;
  }

  private static getCurrentEpoch(): number {
    return Math.ceil(new Date().getTime() / 1000);
  }
}
