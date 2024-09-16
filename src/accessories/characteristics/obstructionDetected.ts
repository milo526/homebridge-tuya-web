import { CharacteristicGetCallback } from "homebridge";
import { TuyaWebCharacteristic } from "./base";
import { BaseAccessory } from "../BaseAccessory";
import { DeviceState } from "../../api/response";

export class ObstructionDetectedCharacteristic extends TuyaWebCharacteristic {
  public static Title = "Characteristic.ObstructionDetected";

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.ObstructionDetected;
  }

  public static isSupportedByAccessory(): boolean {
    return true;
  }

  public getRemoteValue(callback: CharacteristicGetCallback): void {
    this.updateValue({}, callback);
  }

  updateValue(data: DeviceState, callback?: CharacteristicGetCallback): void {
    this.debug("Setting position state to stopped");
    this.accessory.setCharacteristic(
      this.homekitCharacteristic,
      false,
      !callback,
    );
    callback && callback(null, false);
  }
}
