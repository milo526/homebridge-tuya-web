import { CharacteristicGetCallback } from "homebridge";
import { TuyaWebCharacteristic } from "./base";
import { BaseAccessory } from "../BaseAccessory";
import type { DeviceState } from "../../api/response";

export class PositionStateCharacteristic extends TuyaWebCharacteristic {
  public static Title = "Characteristic.PositionState";

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.PositionState;
  }

  public static isSupportedByAccessory(): boolean {
    return true;
  }

  private get PositionState() {
    return this.accessory.platform.Characteristic.PositionState;
  }

  public getRemoteValue(callback: CharacteristicGetCallback): void {
    this.updateValue({}, callback);
  }

  updateValue(data: DeviceState, callback?: CharacteristicGetCallback): void {
    this.debug("Setting position state to stopped");
    this.accessory.setCharacteristic(
      this.homekitCharacteristic,
      this.PositionState.STOPPED,
      !callback,
    );
    callback && callback(null, this.PositionState.STOPPED);
  }
}
