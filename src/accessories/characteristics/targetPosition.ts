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
import { CoverState, DeviceState, ExtendedBoolean } from "../../api/response";
import { CoverAccessory } from "../CoverAccessory";
import delay from "../../helpers/delay";
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
    const a = <CoverAccessory>this.accessory;
    callback && callback(null, a.target);
  }

  public setRemoteValue(
    homekitValue: CharacteristicValue,
    callback: CharacteristicSetCallback,
  ): void {
    const value = (homekitValue as number) === 0 ? 0 : 1;

    const coverAccessory = <CoverAccessory>this.accessory;
    const target = value ? 100 : 0;

    this.debug("Setting targetPosition to %d", target);

    this.accessory
      .setDeviceState("turnOnOff", { value }, value)
      .then(async () => {
        this.debug("[SET] turnOnOff command sent with value %s", value);
        callback();

        this.debug("Setting targetPosition to %d", target);
        coverAccessory.target = target;
        this.accessory.setCharacteristic(
          this.accessory.platform.Characteristic.TargetPosition,
          target,
          true
        );

        coverAccessory.motor = value
          ? this.accessory.platform.Characteristic.PositionState.INCREASING
          : this.accessory.platform.Characteristic.PositionState.DECREASING;
        this.accessory.setCharacteristic(
          this.accessory.platform.Characteristic.PositionState,
          coverAccessory.motor,
          true
        );

        await delay(5000);

        this.debug(
          "Setting currentPosition to %d and positionState to STOPPED",
          target
        );

        coverAccessory.position = target;
        this.accessory.setCharacteristic(
          this.accessory.platform.Characteristic.CurrentPosition,
          coverAccessory.position,
          true
        );

        coverAccessory.motor = this.accessory.platform.Characteristic.PositionState.STOPPED;
        this.accessory.setCharacteristic(
          this.accessory.platform.Characteristic.PositionState,
          this.accessory.platform.Characteristic.PositionState.STOPPED,
          true
        );
      })
      .catch(this.accessory.handleError("SET", callback));
  }

  updateValue(data: DeviceState, callback?: CharacteristicGetCallback): void {
    callback && callback(null, (<CoverAccessory>this.accessory).target);
  }
}
