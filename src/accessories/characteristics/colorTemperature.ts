import {
  Characteristic,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  Formats,
} from "homebridge";
import { TuyaWebCharacteristic } from "./base";
import { MapRange } from "../../helpers/MapRange";
import { BaseAccessory } from "../BaseAccessory";
import { DeviceState } from "../../api/response";

// HomeKit uses mired (micro reciprocal degrees): mired = 1,000,000 / Kelvin
// New Tuya API (temp_value_v2): 0–1000 where 0 = warmest, 1000 = coolest

export class ColorTemperatureCharacteristic extends TuyaWebCharacteristic {
  public static Title = "Characteristic.ColorTemperature";

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.ColorTemperature;
  }

  public static isSupportedByAccessory(accessory: BaseAccessory): boolean {
    return accessory.deviceConfig.data.color_temp !== undefined;
  }

  public setProps(char?: Characteristic): Characteristic | undefined {
    return char?.setProps({
      format: Formats.INT,
      minValue: this.minMired,
      maxValue: this.maxMired,
    });
  }

  public get minMired(): number {
    const data = this.accessory.deviceConfig.config;
    if (data?.max_kelvin) {
      return Math.round(1000000 / Number(data.max_kelvin));
    }
    return 140;
  }

  public get maxMired(): number {
    const data = this.accessory.deviceConfig.config;
    if (data?.min_kelvin) {
      return Math.round(1000000 / Number(data.min_kelvin));
    }
    return 500;
  }

  // Tuya 0 (warm) → maxMired, Tuya 1000 (cool) → minMired
  public rangeMapper = MapRange.tuya(0, 1000).homeKit(
    this.maxMired,
    this.minMired,
  );

  public getRemoteValue(callback: CharacteristicGetCallback): void {
    this.accessory
      .getDeviceState()
      .then((data) => {
        this.debug("[GET] %s", data?.color_temp);
        this.updateValue(data, callback);
      })
      .catch(this.accessory.handleError("GET", callback));
  }

  public setRemoteValue(
    homekitValue: CharacteristicValue,
    callback: CharacteristicSetCallback,
  ): void {
    if (typeof homekitValue !== "number") {
      const errorMsg = `Received unexpected temperature value ${JSON.stringify(
        homekitValue,
      )} of type ${typeof homekitValue}`;
      this.warn(errorMsg);
      callback(new Error(errorMsg));
      return;
    }

    const value = Math.round(this.rangeMapper.homekitToTuya(homekitValue));

    this.accessory
      .setDeviceState("colorTemperatureSet", { value }, { color_temp: value })
      .then(() => {
        this.debug("[SET] mired=%s tuya=%s", homekitValue, value);
        callback();
      })
      .catch(this.accessory.handleError("SET", callback));
  }

  updateValue(data: DeviceState, callback?: CharacteristicGetCallback): void {
    if (data?.color_temp !== undefined) {
      const tuyaValue = Number(data.color_temp);
      const homekitColorTemp = Math.round(
        this.rangeMapper.tuyaToHomekit(tuyaValue),
      );

      if (homekitColorTemp > this.maxMired) {
        this.warn(
          "ColorTemperature mired (%s) exceeds max (%s) for Tuya value (%s). Check your configuration.",
          homekitColorTemp,
          this.maxMired,
          tuyaValue,
        );
      } else if (homekitColorTemp < this.minMired) {
        this.warn(
          "ColorTemperature mired (%s) below min (%s) for Tuya value (%s). Check your configuration.",
          homekitColorTemp,
          this.minMired,
          tuyaValue,
        );
      }

      this.accessory.setCharacteristic(
        this.homekitCharacteristic,
        homekitColorTemp,
        !callback,
      );
      callback && callback(null, homekitColorTemp);
    } else {
      callback &&
        callback(new Error("Could not find required property 'color_temp'"));
    }
  }
}
