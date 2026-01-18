import {
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
} from "homebridge";
import { COLOR_MODES } from "./index";
import { inspect } from "util";
import { TuyaWebCharacteristic } from "./base";
import { BaseAccessory } from "../BaseAccessory";
import type { DeviceState } from "../../api/response";
import { MapRange } from "../../helpers/MapRange";

export class BrightnessCharacteristic extends TuyaWebCharacteristic {
  public static Title = "Characteristic.Brightness";

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.Brightness;
  }

  public static isSupportedByAccessory(accessory: BaseAccessory): boolean {
    const configData = accessory.deviceConfig.data;
    return (
      configData.brightness !== undefined ||
      configData.color?.brightness !== undefined
    );
  }

  public static DEFAULT_VALUE = 100;

  public get usesColorBrightness(): boolean {
    const deviceData = this.accessory.deviceConfig.data;
    return (
      deviceData?.color_mode !== undefined &&
      (COLOR_MODES as readonly string[]).includes(deviceData.color_mode) &&
      deviceData?.color?.brightness !== undefined
    );
  }

  public get rangeMapper(): MapRange {
    let minTuya = 10;
    let maxTuya = 100;
    if (
      this.accessory.deviceConfig.config?.min_brightness !== undefined &&
      this.accessory.deviceConfig.config?.max_brightness !== undefined
    ) {
      minTuya = Number(this.accessory.deviceConfig.config?.min_brightness);
      maxTuya = Number(this.accessory.deviceConfig.config?.max_brightness);
    } else if (this.usesColorBrightness) {
      minTuya = 1;
      maxTuya = 255;
    }

    return MapRange.tuya(minTuya, maxTuya).homeKit(0, 100);
  }

  public getRemoteValue(callback: CharacteristicGetCallback): void {
    this.accessory
      .getDeviceState()
      .then((data) => {
        this.debug("[GET] %s", data?.brightness ?? data?.color?.brightness);
        this.updateValue(data, callback);
      })
      .catch(this.accessory.handleError("GET", callback));
  }

  public setRemoteValue(
    homekitValue: CharacteristicValue,
    callback: CharacteristicSetCallback,
  ): void {
    const value = this.rangeMapper.homekitToTuya(Number(homekitValue));

    this.accessory
      .setDeviceState(
        "brightnessSet",
        { value },
        this.usesColorBrightness
          ? { color: { brightness: String(value) } }
          : { brightness: value },
      )
      .then(() => {
        this.debug("[SET] %s", value);
        callback();
      })
      .catch(this.accessory.handleError("SET", callback));
  }

  updateValue(data: DeviceState, callback?: CharacteristicGetCallback): void {
    const tuyaValue = Number(
      this.usesColorBrightness ? data.color?.brightness : data.brightness,
    );
    let homekitValue = this.rangeMapper.tuyaToHomekit(tuyaValue);

    // Clamp to HomeKit valid range (0-100)
    if (homekitValue > 100) {
      this.warn(
        "Characteristic 'Brightness' received value higher than allowed (%s) from Tuya value (%s). " +
          "Clamping to 100. Consider updating your min/max brightness configuration.",
        homekitValue,
        tuyaValue,
      );
      homekitValue = 100;
    } else if (homekitValue < 0) {
      this.warn(
        "Characteristic 'Brightness' received value lower than allowed (%s) from Tuya value (%s). " +
          "Clamping to 0. Consider updating your min/max brightness configuration.",
        homekitValue,
        tuyaValue,
      );
      homekitValue = 0;
    }

    // Round to integer for HomeKit
    homekitValue = Math.round(homekitValue);

    // Allow 0 as a valid value (light is off)
    if (homekitValue !== undefined && !isNaN(homekitValue)) {
      this.accessory.setCharacteristic(
        this.homekitCharacteristic,
        homekitValue,
        !callback,
      );
      callback && callback(null, homekitValue);
      return;
    }

    const error = new Error(
      `Tried to set brightness but failed to parse data. \n ${inspect(data)}`,
    );

    this.error(error.message);

    callback && callback(error);
  }
}
