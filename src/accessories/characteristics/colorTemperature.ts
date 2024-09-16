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

// Homekit uses mired light units, Tuya uses kelvin
// Mired = 1.000.000/Kelvin

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
    });
  }

  public get minKelvin(): number {
    const data = this.accessory.deviceConfig.config;
    return Number(data?.min_kelvin) || 1000000 / 500;
  }

  public get maxKelvin(): number {
    const data = this.accessory.deviceConfig.config;
    return Number(data?.max_kelvin) || 1000000 / 140;
  }

  public get minHomekit(): number {
    return 1000000 / this.maxKelvin;
  }

  public get maxHomekit(): number {
    return 1000000 / this.minKelvin;
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
      const homekitColorTemp = Math.round(
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
      } else if (homekitColorTemp < this.minHomekit) {
        this.warn(
          "Characteristic 'ColorTemperature' will receive value lower than allowed mired (%s) since provided Tuya kelvin value (%s) " +
            "exceeds configured maximum Tuya kelvin value (%s). Please update your configuration!",
          homekitColorTemp,
          tuyaValue,
          this.rangeMapper.tuyaEnd,
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
