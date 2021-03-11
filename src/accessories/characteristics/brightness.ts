import {
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
} from "homebridge";
import { COLOR_MODES } from "./index";
import { inspect } from "util";
import { TuyaWebCharacteristic } from "./base";
import { BaseAccessory } from "../BaseAccessory";
import { DeviceState } from "../../api/response";
import { DimmerAccessory } from "../DimmerAccessory";

export class BrightnessCharacteristic extends TuyaWebCharacteristic {
  public static Title = "Characteristic.Brightness";

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.Brightness;
  }

  public static DEFAULT_VALUE = 100;

  public static isSupportedByAccessory(accessory): boolean {
    const configData = accessory.deviceConfig.data;
    return (
      configData.brightness !== undefined ||
      configData.color?.brightness !== undefined
    );
  }

  public getRemoteValue(callback: CharacteristicGetCallback): void {
    this.accessory
      .getDeviceState()
      .then((data) => {
        this.debug("[GET] %s", data?.brightness || data?.color?.brightness);
        this.updateValue(data, callback);
      })
      .catch(this.accessory.handleError("GET", callback));
  }

  public setRemoteValue(
    homekitValue: CharacteristicValue,
    callback: CharacteristicSetCallback
  ): void {
    // Set device state in Tuya Web API
    const dimmerPercentage = (homekitValue as number) / 100;
    const correctionFactor = 10;
    const value = Math.round(
      (100 - correctionFactor) * dimmerPercentage +
        correctionFactor +
        Number.EPSILON
    );

    this.accessory
      .setDeviceState("brightnessSet", { value }, { brightness: homekitValue })
      .then(() => {
        this.debug("[SET] %s", value);
        callback();
      })
      .catch(this.accessory.handleError("SET", callback));
  }

  updateValue(data: DeviceState, callback?: CharacteristicGetCallback): void {
    // data.brightness only valid for color_mode != color > https://github.com/PaulAnnekov/tuyaha/blob/master/tuyaha/devices/light.py
    // however, according to local tuya app, calculation for color_mode=color is still incorrect (even more so in lower range)
    let stateValue: number | undefined;
    if (
      data?.color_mode !== undefined &&
      data?.color_mode in COLOR_MODES &&
      data?.color?.brightness !== undefined
    ) {
      stateValue = Number(data.color.brightness);
    } else if (data?.brightness) {
      const maxBrightness = (this.accessory as DimmerAccessory).maxBrightness;
      const brightness = Number(data.brightness);
      stateValue = Math.round(
        (brightness / maxBrightness) * 100 + Number.EPSILON
      );
    }

    if (stateValue) {
      this.accessory.setCharacteristic(
        this.homekitCharacteristic,
        stateValue,
        !callback
      );
      callback && callback(null, stateValue);
      return;
    }

    this.error(
      "Tried to set brightness but failed to parse data. \n %s",
      inspect(data)
    );
  }
}
