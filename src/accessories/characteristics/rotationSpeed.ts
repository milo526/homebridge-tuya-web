import {
  Characteristic,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  Formats,
  Units,
} from "homebridge";
import { TuyaWebCharacteristic } from "./base";
import { BaseAccessory } from "../BaseAccessory";
import { MapRange } from "../../helpers/MapRange";
import { DeviceState } from "../../api/response";

export class RotationSpeedCharacteristic extends TuyaWebCharacteristic {
  public static Title = "Characteristic.RotationSpeed";

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.RotationSpeed;
  }

  public range = MapRange.tuya(1, this.maxSpeedLevel).homeKit(
    this.minStep,
    this.maxSpeedLevel * this.minStep,
  );

  public setProps(char?: Characteristic): Characteristic | undefined {
    return char?.setProps({
      unit: Units.PERCENTAGE,
      format: Formats.INT,
      minValue: 0,
      maxValue: 100,
      minStep: this.minStep,
    });
  }

  public static isSupportedByAccessory(accessory: BaseAccessory): boolean {
    return (
      accessory.deviceConfig.data.speed_level !== undefined &&
      accessory.deviceConfig.data.speed !== undefined
    );
  }

  public get maxSpeedLevel(): number {
    const data = this.accessory.deviceConfig.data;
    return Number(data.speed_level) || 1;
  }

  public get minStep(): number {
    return Math.floor(100 / this.maxSpeedLevel);
  }

  public getRemoteValue(callback: CharacteristicGetCallback): void {
    this.accessory
      .getDeviceState()
      .then((data) => {
        this.debug("[GET] %s", data?.speed);
        this.updateValue(data, callback);
      })
      .catch(this.accessory.handleError("GET", callback));
  }

  public setRemoteValue(
    homekitValue: CharacteristicValue,
    callback: CharacteristicSetCallback,
  ): void {
    // Set device state in Tuya Web API
    let value = this.range.homekitToTuya(Number(homekitValue));
    // Set value to 1 if value is too small
    value = value < 1 ? 1 : value;
    // Set value to minSpeedLevel if value is too large
    value = value > this.maxSpeedLevel ? this.maxSpeedLevel : value;

    this.accessory
      .setDeviceState("windSpeedSet", { value }, { speed: value })
      .then(() => {
        this.debug("[SET] %s %s", homekitValue, value);
        callback();
      })
      .catch(this.accessory.handleError("SET", callback));
  }

  updateValue(data: DeviceState, callback?: CharacteristicGetCallback): void {
    if (data?.speed !== undefined) {
      const speed = this.range.tuyaToHomekit(Number(data.speed));
      this.accessory.setCharacteristic(
        this.homekitCharacteristic,
        speed,
        !callback,
      );
      callback && callback(null, speed);
    } else {
      callback &&
        callback(new Error(`Unexpected speed value provided: ${data?.speed}`));
    }
  }
}
