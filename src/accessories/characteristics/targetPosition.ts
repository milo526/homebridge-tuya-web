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
import { CoverState } from "../../api/response";
import type { DeviceState, ExtendedBoolean } from "../../api/response";
import { TuyaBoolean } from "../../helpers/TuyaBoolean";

export class TargetPositionCharacteristic extends TuyaWebCharacteristic {
  public static Title = "Characteristic.TargetPosition";

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.TargetPosition;
  }

  public setProps(char?: Characteristic): Characteristic | undefined {
    return char?.setProps({
      unit: Units.PERCENTAGE,
      format: Formats.INT,
      minValue: 0,
      maxValue: 100,
      minStep: 100,
    });
  }

  public static isSupportedByAccessory(): boolean {
    return true;
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
    const value = (homekitValue as number) === 0 ? 0 : 1;

    const data: DeviceState = {
      target_cover_state: value === 0 ? CoverState.Closing : CoverState.Opening,
      state: value === 0 ? CoverState.Closing : CoverState.Opening,
    };

    this.accessory
      .setDeviceState("turnOnOff", { value }, data)
      .then(() => {
        this.debug("[SET] %s", value);
        callback();
      })
      .catch(this.accessory.handleError("SET", callback));
  }

  updateValue(data: DeviceState, callback?: CharacteristicGetCallback): void {
    if (!isNaN(Number(String(data?.state)))) {
      //State is a number and probably 1, 2 or 3
      const state = Number(data.state);

      let stateValue: 0 | 50 | 100;

      switch (state) {
        case CoverState.Opening:
          stateValue = 100;
          break;
        case CoverState.Closing:
          stateValue = 0;
          break;
        default:
          if (data.target_cover_state === CoverState.Opening) {
            stateValue = 100;
          } else if (data.target_cover_state === CoverState.Stopped) {
            stateValue = 50;
          } else {
            stateValue = 0;
          }
      }

      this.accessory.setCharacteristic(
        this.homekitCharacteristic,
        stateValue,
        !callback,
      );
      callback && callback(null, stateValue);
    } else if (["true", "false"].includes(String(data?.state).toLowerCase())) {
      const stateValue = TuyaBoolean(data.state as ExtendedBoolean) ? 100 : 0;
      this.accessory.setCharacteristic(
        this.homekitCharacteristic,
        stateValue,
        !callback,
      );
      callback && callback(null, stateValue);
    } else {
      callback &&
        callback(new Error(`Unexpected state value provided: ${data?.state}`));
    }
  }
}
