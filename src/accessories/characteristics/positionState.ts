import { CharacteristicGetCallback } from "homebridge";
import { TuyaWebCharacteristic } from "./base";
import { BaseAccessory } from "../BaseAccessory";
import { DeviceState } from "../../api/response";
import { CoverAccessory } from "..";

export class PositionStateCharacteristic extends TuyaWebCharacteristic {
  public static Title = "Characteristic.PositionState";

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.PositionState;
  }

  public static isSupportedByAccessory(): boolean {
    return true;
  }

  public getRemoteValue(callback: CharacteristicGetCallback): void {
    this.updateValue({}, callback);
  }

  updateValue(data: DeviceState, callback?: CharacteristicGetCallback): void {
    callback && callback(null, (<CoverAccessory>this.accessory).motor);
  }
}
