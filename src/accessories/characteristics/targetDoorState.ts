import {
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
} from "homebridge";
import { TuyaWebCharacteristic } from "./base";
import { BaseAccessory } from "../BaseAccessory";
import { CoverState, DeviceState, ExtendedBoolean } from "../../api/response";
import { TuyaBoolean } from "../../helpers/TuyaBoolean";

export class TargetDoorStateCharacteristic extends TuyaWebCharacteristic {
  public static Title = "Characteristic.TargetDoorState";

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.TargetDoorState;
  }

  public static isSupportedByAccessory(): boolean {
    return true;
  }

  public get TargetDoorState() {
    return this.accessory.platform.Characteristic.TargetDoorState;
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
    const value =
      (homekitValue as number) === this.TargetDoorState.CLOSED ? 0 : 1;

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

      let stateValue: 0 | 1 = this.TargetDoorState.OPEN;

      switch (state) {
        case CoverState.Opening:
          stateValue = this.TargetDoorState.OPEN;
          break;
        case CoverState.Closing:
          stateValue = this.TargetDoorState.CLOSED;
          break;
        default:
          if (!isNaN(Number(String(data?.target_cover_state)))) {
            stateValue =
              data.target_cover_state === CoverState.Closing
                ? this.TargetDoorState.CLOSED
                : this.TargetDoorState.OPEN;
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
        ? this.TargetDoorState.OPEN
        : this.TargetDoorState.CLOSED;
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
