import {
  Characteristic,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
} from "homebridge";
import { TuyaWebCharacteristic } from "./base";
import { BaseAccessory } from "../BaseAccessory";
import { ClimateMode } from "./index";
import { DeviceState, ExtendedBoolean } from "../../api/response";
import { TuyaBoolean } from "../../helpers/TuyaBoolean";

export class TargetHeatingCoolingStateCharacteristic extends TuyaWebCharacteristic {
  public static Title = "Characteristic.TargetHeatingCoolingState";

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.TargetHeatingCoolingState;
  }

  public static isSupportedByAccessory(): boolean {
    return true;
  }

  public setProps(char?: Characteristic): Characteristic | undefined {
    const validValues = [
      this.TargetHeatingCoolingState.OFF,
      this.TargetHeatingCoolingState.AUTO,
    ];
    if (this.canSpecifyTarget) {
      validValues.push(
        this.TargetHeatingCoolingState.COOL,
        this.TargetHeatingCoolingState.HEAT,
      );
    }
    return char?.setProps({
      validValues,
    });
  }

  public get canSpecifyTarget(): boolean {
    const data = this.accessory.deviceConfig.data;
    return !!data.mode;
  }

  public getRemoteValue(callback: CharacteristicGetCallback): void {
    this.accessory
      .getDeviceState()
      .then((data) => {
        const d = {
          state: data.state,
          mode: data.mode,
        };
        this.debug("[GET] %s", d);
        this.updateValue(d, callback);
      })
      .catch(this.accessory.handleError("GET", callback));
  }

  private get TargetHeatingCoolingState() {
    return this.accessory.platform.Characteristic.TargetHeatingCoolingState;
  }

  public setRemoteValue(
    homekitValue: CharacteristicValue,
    callback: CharacteristicSetCallback,
  ): void {
    if (homekitValue === this.TargetHeatingCoolingState.OFF) {
      this.accessory
        .setDeviceState("turnOnOff", { value: 0 }, { state: false })
        .then(() => {
          this.debug("[SET] %s", homekitValue);
          callback();
        })
        .catch(this.accessory.handleError("SET", callback));
      return;
    }

    const map: Record<number, ClimateMode> = {
      [this.TargetHeatingCoolingState.AUTO]: "auto",
      [this.TargetHeatingCoolingState.HEAT]: "hot",
      [this.TargetHeatingCoolingState.COOL]: "cold",
    };

    const value = map[homekitValue as number];
    this.accessory
      .setDeviceState("turnOnOff", { value: 1 }, { state: true })
      .then(() => {
        if (this.canSpecifyTarget) {
          this.accessory
            .setDeviceState("modeSet", { value }, { mode: value })
            .then(() => {
              this.debug("[SET] %s %s", homekitValue, value);
              callback();
            })
            .catch(this.accessory.handleError("SET", callback));
        } else {
          callback();
        }
      })
      .catch(this.accessory.handleError("SET", callback));
  }

  updateValue(data: DeviceState, callback?: CharacteristicGetCallback): void {
    if (!TuyaBoolean(data?.state as ExtendedBoolean)) {
      this.accessory.setCharacteristic(
        this.homekitCharacteristic,
        this.TargetHeatingCoolingState.OFF,
        !callback,
      );
      this.debug("[UPDATE] %s", "OFF");
      callback && callback(null, this.TargetHeatingCoolingState.OFF);
      return;
    }

    const mode = {
      auto: this.TargetHeatingCoolingState.AUTO,
      wind: this.TargetHeatingCoolingState.AUTO,
      hot: this.TargetHeatingCoolingState.HEAT,
      cold: this.TargetHeatingCoolingState.COOL,
    }[data?.mode ?? "auto"];
    this.debug(
      "[UPDATE] %s",
      mode === this.TargetHeatingCoolingState.HEAT
        ? "HEAT"
        : mode === this.TargetHeatingCoolingState.COOL
        ? "COOL"
        : "AUTO",
    );
    this.accessory.setCharacteristic(
      this.homekitCharacteristic,
      mode,
      !callback,
    );
    callback && callback(null, mode);
  }
}
