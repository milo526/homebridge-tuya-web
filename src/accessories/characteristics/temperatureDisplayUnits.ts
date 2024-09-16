import { TuyaWebCharacteristic } from "./base";
import { BaseAccessory } from "../BaseAccessory";
import { CharacteristicGetCallback } from "homebridge";
import { DeviceState } from "../../api/response";

export class TemperatureDisplayUnitsCharacteristic extends TuyaWebCharacteristic {
  public static Title = "Characteristic.TemperatureDisplayUnits";

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.TemperatureDisplayUnits;
  }

  public static isSupportedByAccessory(): boolean {
    return true;
  }

  public getRemoteValue(callback: CharacteristicGetCallback): void {
    this.updateValue(undefined, callback);
  }

  private get TemperatureDisplayUnits() {
    return this.accessory.platform.Characteristic.TemperatureDisplayUnits;
  }

  updateValue(
    data: DeviceState | undefined,
    callback?: CharacteristicGetCallback,
  ): void {
    callback && callback(null, this.TemperatureDisplayUnits.CELSIUS);
  }
}
