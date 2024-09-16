import {
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
} from "homebridge";
import { TuyaWebCharacteristic } from "./base";
import { BaseAccessory } from "../BaseAccessory";
import { DeviceState, ExtendedBoolean } from "../../api/response";
import { TuyaBoolean } from "../../helpers/TuyaBoolean";

export class OnCharacteristic extends TuyaWebCharacteristic {
  public static Title = "Characteristic.On";

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.On;
  }

  public static isSupportedByAccessory(accessory: BaseAccessory): boolean {
    return accessory.deviceConfig.data.state !== undefined;
  }

  public getRemoteValue(callback: CharacteristicGetCallback): void {
    this.accessory
      .getDeviceState()
      .then((data) => {
        this.debug("[GET] %s", data?.state);
        this.updateValue(data, callback);
      })
      .catch(this.accessory.handleError("GET", callback));
  }

  public setRemoteValue(
    homekitValue: CharacteristicValue,
    callback: CharacteristicSetCallback,
  ): void {
    // Set device state in Tuya Web API
    const value = homekitValue ? 1 : 0;

    this.accessory
      .setDeviceState("turnOnOff", { value }, { state: Boolean(homekitValue) })
      .then(() => {
        this.debug("[SET] %s %s", homekitValue, value);
        callback();
      })
      .catch(this.accessory.handleError("SET", callback));
  }

  updateValue(data: DeviceState, callback?: CharacteristicGetCallback): void {
    if (data?.state !== undefined) {
      const stateValue = TuyaBoolean(data.state as ExtendedBoolean);
      this.accessory.setCharacteristic(
        this.homekitCharacteristic,
        stateValue,
        !callback,
      );
      callback && callback(null, stateValue);
    } else {
      callback &&
        callback(new Error("Could not find required property 'state'"));
    }
  }
}
