import { CharacteristicGetCallback } from "homebridge";
import { TuyaWebCharacteristic } from "./base";
import { BaseAccessory } from "../BaseAccessory";
import { CoverState, DeviceState, ExtendedBoolean } from "../../api/response";
import { TuyaBoolean } from "../../helpers/TuyaBoolean";

export class CurrentDoorStateCharacteristic extends TuyaWebCharacteristic {
  public static Title = "Characteristic.CurrentDoorState";

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.CurrentDoorState;
  }

  public static isSupportedByAccessory(): boolean {
    return true;
  }

  public get CurrentDoorState() {
    return this.accessory.platform.Characteristic.CurrentDoorState;
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
          stateValue = this.CurrentDoorState.OPENING;
          break;
        case CoverState.Closing:
          stateValue = this.CurrentDoorState.CLOSING;
          break;
        case CoverState.Stopped:
        default:
          if (data.target_cover_state === CoverState.Opening) {
            stateValue = this.CurrentDoorState.OPEN;
          } else if (data.target_cover_state === CoverState.Stopped) {
            stateValue = this.CurrentDoorState.CLOSED;
          } else {
            stateValue = this.CurrentDoorState.STOPPED;
          }
      }

      this.accessory.setCharacteristic(
        this.homekitCharacteristic,
        stateValue,
        !callback,
      );
      callback && callback(null, stateValue);
    } else if (["true", "false"].includes(String(data?.state).toLowerCase())) {
      const stateValue = TuyaBoolean(data.state as ExtendedBoolean)
        ? this.CurrentDoorState.OPEN
        : this.CurrentDoorState.CLOSED;
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
