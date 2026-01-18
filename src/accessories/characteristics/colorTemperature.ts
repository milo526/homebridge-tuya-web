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
import type { DeviceState } from "../../api/response";

// HomeKit uses mired light units, Tuya uses kelvin
// Mired = 1,000,000 / Kelvin
// HomeKit valid range: 140-500 mireds (≈7143K to 2000K)
// Typical Tuya bulbs: 2700K-6500K (≈370 to 154 mireds)

// HomeKit absolute limits
const HOMEKIT_MIN_MIRED = 140; // ≈7143K (coolest)
const HOMEKIT_MAX_MIRED = 500; // 2000K (warmest)

// Default Tuya Kelvin range (matches response.ts conversion)
const DEFAULT_MIN_KELVIN = 2700; // Warm white
const DEFAULT_MAX_KELVIN = 6500; // Cool white

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
      minValue: this.minHomekit,
      maxValue: this.maxHomekit,
      minStep: 1,
    });
  }

  public get minKelvin(): number {
    const data = this.accessory.deviceConfig.config;
    return Number(data?.min_kelvin) || DEFAULT_MIN_KELVIN;
  }

  public get maxKelvin(): number {
    const data = this.accessory.deviceConfig.config;
    return Number(data?.max_kelvin) || DEFAULT_MAX_KELVIN;
  }

  // Convert Kelvin to Mired, clamped to HomeKit's valid range
  public get minHomekit(): number {
    const mired = Math.round(1000000 / this.maxKelvin);
    return Math.max(HOMEKIT_MIN_MIRED, Math.min(HOMEKIT_MAX_MIRED, mired));
  }

  public get maxHomekit(): number {
    const mired = Math.round(1000000 / this.minKelvin);
    return Math.max(HOMEKIT_MIN_MIRED, Math.min(HOMEKIT_MAX_MIRED, mired));
  }

  public rangeMapper = MapRange.tuya(this.maxKelvin, this.minKelvin).homeKit(
    this.minHomekit,
    this.maxHomekit,
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

    // Set device state in Tuya Web API
    const value = Math.round(this.rangeMapper.homekitToTuya(homekitValue));

    this.accessory
      .setDeviceState("colorTemperatureSet", { value }, { color_temp: value })
      .then(() => {
        this.debug("[SET] %s %s", homekitValue, value);
        callback();
      })
      .catch(this.accessory.handleError("SET", callback));
  }

  updateValue(data: DeviceState, callback?: CharacteristicGetCallback): void {
    if (data?.color_temp !== undefined) {
      const tuyaValue = data.color_temp;
      let homekitColorTemp = Math.round(
        this.rangeMapper.tuyaToHomekit(Number(data.color_temp)),
      );

      if (homekitColorTemp > this.maxHomekit) {
        this.warn(
          "Characteristic 'ColorTemperature' will receive value higher than allowed mired (%s) since provided Tuya kelvin value (%s) " +
            "is lower then configured minimum Tuya kelvin value (%s). Please update your configuration!",
          homekitColorTemp,
          tuyaValue,
          this.rangeMapper.tuyaStart,
        );
        // Clamp to valid range
        homekitColorTemp = this.maxHomekit;
      } else if (homekitColorTemp < this.minHomekit) {
        this.warn(
          "Characteristic 'ColorTemperature' will receive value lower than allowed mired (%s) since provided Tuya kelvin value (%s) " +
            "exceeds configured maximum Tuya kelvin value (%s). Please update your configuration!",
          homekitColorTemp,
          tuyaValue,
          this.rangeMapper.tuyaEnd,
        );
        // Clamp to valid range
        homekitColorTemp = this.minHomekit;
      }

      // Ensure value is a valid integer within HomeKit's acceptable range (140-500 mireds)
      homekitColorTemp = Math.max(140, Math.min(500, Math.round(homekitColorTemp)));

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
