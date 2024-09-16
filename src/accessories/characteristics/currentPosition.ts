import { CharacteristicGetCallback } from "homebridge";
import { TuyaWebCharacteristic } from "./base";
import { BaseAccessory } from "../BaseAccessory";
import { CoverState, DeviceState, ExtendedBoolean } from "../../api/response";
import { CoverAccessory } from "..";
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
    this.updateValue({}, callback);
  }

  updateValue(data: DeviceState, callback?: CharacteristicGetCallback): void {
    callback && callback(null, (<CoverAccessory>this.accessory).position);
  }
}
