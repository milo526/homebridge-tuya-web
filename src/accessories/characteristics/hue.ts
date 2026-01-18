import {
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
} from "homebridge";
import { COLOR_MODES } from "./index";
import { TuyaWebCharacteristic } from "./base";
import { ColorAccessory } from "../ColorAccessory";
import { BaseAccessory } from "../BaseAccessory";
import type { DeviceState } from "../../api/response";

export class HueCharacteristic extends TuyaWebCharacteristic<ColorAccessory> {
  public static Title = "Characteristic.Hue";

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.Hue;
  }

  public static DEFAULT_VALUE = 0;

  public static isSupportedByAccessory(accessory: BaseAccessory): boolean {
    const configData = accessory.deviceConfig.data;
    return configData.color_mode !== undefined;
  }

  public getRemoteValue(callback: CharacteristicGetCallback): void {
    this.accessory
      .getDeviceState()
      .then((data) => {
        this.debug("[GET] %s", data?.color?.hue);
        this.updateValue(data, callback);
      })
      .catch(this.accessory.handleError("GET", callback));
  }

  public setRemoteValue(
    homekitValue: CharacteristicValue,
    callback: CharacteristicSetCallback,
  ): void {
    // Set device state in Tuya Web API
    const value = homekitValue as number;

    this.accessory
      .setColor({ hue: value })
      .then(() => {
        this.debug("[SET] %s", value);
        callback();
      })
      .catch(this.accessory.handleError("SET", callback));
  }

  updateValue(data: DeviceState, callback?: CharacteristicGetCallback): void {
    let stateValue: number = HueCharacteristic.DEFAULT_VALUE;
    if (
      data?.color_mode !== undefined &&
      (COLOR_MODES as readonly string[]).includes(data.color_mode) &&
      data?.color?.hue
    ) {
      stateValue = Number(data.color.hue);
    }

    // Clamp to HomeKit valid range (0-360)
    if (stateValue < 0) {
      this.debug("Hue value %s below 0, clamping to 0", stateValue);
      stateValue = 0;
    } else if (stateValue > 360) {
      this.debug("Hue value %s above 360, clamping to 360", stateValue);
      stateValue = 360;
    }
    stateValue = Math.round(stateValue);

    this.accessory.setCharacteristic(
      this.homekitCharacteristic,
      stateValue,
      !callback,
    );
    callback && callback(null, stateValue);
  }
}
