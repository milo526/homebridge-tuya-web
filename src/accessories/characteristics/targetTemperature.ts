import {
  Characteristic,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
} from "homebridge";
import { TuyaWebCharacteristic } from "./base";
import { BaseAccessory } from "../BaseAccessory";
import { ClimateAccessory } from "../ClimateAccessory";
import { DeviceState } from "../../api/response";

export class TargetTemperatureCharacteristic extends TuyaWebCharacteristic {
  public static Title = "Characteristic.TargetTemperature";

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.TargetTemperature;
  }

  private get minTemp(): number {
    if (this.accessory.deviceConfig.config?.min_temper) {
      return Number(this.accessory.deviceConfig.config.min_temper);
    }

    const data = this.accessory.deviceConfig.data;
    if (data.min_temper) {
      return (
        Number(data.min_temper) *
        (this.accessory as ClimateAccessory).targetTemperatureFactor
      );
    }

    return 0;
  }

  private get maxTemp(): number {
    if (this.accessory.deviceConfig.config?.max_temper) {
      return Number(this.accessory.deviceConfig.config.max_temper);
    }

    const data = this.accessory.deviceConfig.data;
    if (data.max_temper) {
      return (
        Number(data.max_temper) *
        (this.accessory as ClimateAccessory).targetTemperatureFactor
      );
    }

    return 100;
  }

  public setProps(char?: Characteristic): Characteristic | undefined {
    return char?.setProps({
      minValue: this.minTemp,
      maxValue: this.maxTemp,
      minStep: 0.5,
    });
  }

  public static isSupportedByAccessory(accessory: BaseAccessory): boolean {
    return accessory.deviceConfig.data.temperature !== undefined;
  }

  public getRemoteValue(callback: CharacteristicGetCallback): void {
    this.accessory
      .getDeviceState()
      .then((data) => {
        this.debug("[GET] %s", data?.temperature);
        this.updateValue(data, callback);
      })
      .catch(this.accessory.handleError("GET", callback));
  }

  public setRemoteValue(
    homekitValue: CharacteristicValue,
    callback: CharacteristicSetCallback,
  ): void {
    const temperature = Number(homekitValue);

    this.accessory
      .setDeviceState(
        "temperatureSet",
        { value: temperature },
        {
          temperature:
            temperature /
            (this.accessory as ClimateAccessory).targetTemperatureFactor,
        },
      )
      .then(() => {
        this.debug("[SET] %s %s", homekitValue, temperature);
        callback();
      })
      .catch(this.accessory.handleError("SET", callback));
  }

  updateValue(data: DeviceState, callback?: CharacteristicGetCallback): void {
    let temperature = data?.temperature
      ? Number(data?.temperature) *
        (this.accessory as ClimateAccessory).targetTemperatureFactor
      : undefined;
    if (temperature) {
      temperature = Math.round(temperature * 10) / 10;

      this.debug("[UPDATE] %s", temperature);
      this.accessory.setCharacteristic(
        this.homekitCharacteristic,
        temperature,
        !callback,
      );
      callback && callback(null, temperature);
    } else {
      callback && callback(new Error("Could not get temperature from data"));
    }
  }
}
