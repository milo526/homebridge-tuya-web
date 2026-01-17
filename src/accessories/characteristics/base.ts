import { BaseAccessory, CharacteristicConstructor } from "../BaseAccessory";
import { LogLevel } from "homebridge";
import {
  Characteristic,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
} from "homebridge";

export abstract class TuyaWebCharacteristic<
  Accessory extends BaseAccessory = BaseAccessory,
> {
  public static Title: string;
  public static HomekitCharacteristic: (
    accessory: BaseAccessory,
  ) => CharacteristicConstructor;

  public setProps(characteristic?: Characteristic): Characteristic | undefined {
    return characteristic;
  }

  constructor(protected accessory: Accessory) {
    this.enable();
  }

  private get staticInstance(): typeof TuyaWebCharacteristic {
    return this.constructor as typeof TuyaWebCharacteristic;
  }

  public get title(): string {
    return this.staticInstance.Title;
  }

  public get homekitCharacteristic(): CharacteristicConstructor {
    return this.staticInstance.HomekitCharacteristic(this.accessory);
  }

  private log(logLevel: LogLevel, message: string, ...args: unknown[]): void {
    this.accessory.log.log(
      logLevel,
      `[%s] %s - ${message}`,
      this.accessory.name,
      this.title,
      ...args,
    );
  }

  protected debug(message: string, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  protected info(message: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  protected warn(message: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  protected error(message: string, ...args: unknown[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }

  /**
   * Getter tuya HomeKit;
   * Should provide HomeKit compatible data homeKit callback
   * @param callback
   */
  public getRemoteValue?(callback: CharacteristicGetCallback): void;

  /**
   * Setter homeKit HomeKit
   * Called when value is changed in HomeKit.
   * Must update remote value
   * Must call callback after completion
   * @param homekitValue
   * @param callback
   */
  public setRemoteValue?(
    homekitValue: CharacteristicValue,
    callback: CharacteristicSetCallback,
  ): void;

  /**
   * Updates the cached value for the device.
   * @param data
   * @param callback
   */
  public updateValue?(
    data?: Accessory["deviceConfig"]["data"],
    callback?: CharacteristicGetCallback,
  ): void;

  private enable(): void {
    const char = this.setProps(
      this.accessory.service?.getCharacteristic(this.homekitCharacteristic),
    );

    if (char) {
      this.debug(JSON.stringify(char.props));
      if (this.getRemoteValue) {
        char.on("get", this.getRemoteValue.bind(this));
      }

      if (this.setRemoteValue) {
        char.on("set", this.setRemoteValue.bind(this));
      }
    }

    if (this.updateValue) {
      this.accessory.addUpdateCallback(
        this.homekitCharacteristic,
        this.updateValue.bind(this),
      );
    }
  }
}
