import {
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
} from "homebridge";
import { TuyaWebCharacteristic } from "./base";
import { BaseAccessory } from "../BaseAccessory";
import { DeviceState } from "../../api/response";

export class MomentaryOnCharacteristic extends TuyaWebCharacteristic {
  public static Title = "Characteristic.MomentaryOn";

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.On;
  }

  public static isSupportedByAccessory(): boolean {
    return true;
  }

  public getRemoteValue(callback: CharacteristicGetCallback): void {
    const value = 0;
    this.debug("[GET] %s", value);
    this.updateValue({}, callback);
  }

  public setRemoteValue(
    homekitValue: CharacteristicValue,
    callback: CharacteristicSetCallback,
  ): void {
    // Set device state in Tuya Web API
    const value = homekitValue ? 1 : 0;

    if (value === 0) {
      callback();
      return;
    }

    this.accessory
      .setDeviceState("turnOnOff", { value }, {})
      .then(() => {
        this.debug("[SET] %s %s", homekitValue, value);
        callback();
        const reset = () => {
          this.accessory.service?.setCharacteristic(
            this.homekitCharacteristic,
            0,
          );
        };
        setTimeout(reset.bind(this), 100);
      })
      .catch(this.accessory.handleError("SET", callback));
  }

  updateValue(data: DeviceState, callback?: CharacteristicGetCallback): void {
    callback && callback(null, 0);
  }
}
