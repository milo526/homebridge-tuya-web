import { CharacteristicGetCallback } from "homebridge";
import { TuyaWebCharacteristic } from "./base";
import { BaseAccessory } from "../BaseAccessory";
import { CoverState } from "../../api/response";
import type { DeviceState, ExtendedBoolean } from "../../api/response";
import { TuyaBoolean } from "../../helpers/TuyaBoolean";

export class CurrentPositionCharacteristic extends TuyaWebCharacteristic {
  public static Title = "Characteristic.CurrentPosition";

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.CurrentPosition;
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

  updateValue(data: DeviceState, callback?: CharacteristicGetCallback): void {
    this.debug(`Updating value`, data);
    if (!isNaN(Number(String(data?.state)))) {
      //State is a number and probably 1, 2 or 3
      const state = Number(data.state);

      let stateValue!: number;

      switch (state) {
        case CoverState.Opening:
          stateValue = 50;
          break;
        case CoverState.Closing:
          stateValue = 50;
          break;
        case CoverState.Stopped:
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
