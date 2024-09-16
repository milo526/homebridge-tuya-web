import { Characteristic, CharacteristicGetCallback } from "homebridge";
import { TuyaWebCharacteristic } from "./base";
import { BaseAccessory } from "../BaseAccessory";
import { DeviceState, ExtendedBoolean } from "../../api/response";
import { TuyaBoolean } from "../../helpers/TuyaBoolean";

export class CurrentHeatingCoolingStateCharacteristic extends TuyaWebCharacteristic {
  public static Title = "Characteristic.CurrentHeatingCoolingState";

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.CurrentHeatingCoolingState;
  }

  public static isSupportedByAccessory(): boolean {
    return true;
  }

  public setProps(char?: Characteristic): Characteristic | undefined {
    const data = this.accessory.deviceConfig.data;
    const validValues = [
      this.CurrentHeatingCoolingState.OFF,
      this.CurrentHeatingCoolingState.HEAT,
    ];
    if (data.mode) {
      validValues.push(this.CurrentHeatingCoolingState.COOL);
    }
    return char?.setProps({
      validValues,
    });
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

  private get CurrentHeatingCoolingState() {
    return this.accessory.platform.Characteristic.CurrentHeatingCoolingState;
  }

  updateValue(data: DeviceState, callback?: CharacteristicGetCallback): void {
    if (!TuyaBoolean(data?.state as ExtendedBoolean)) {
      this.accessory.setCharacteristic(
        this.homekitCharacteristic,
        this.CurrentHeatingCoolingState.OFF,
        !callback,
      );
      this.debug("[UPDATE] %S", "OFF");
      callback && callback(null, this.CurrentHeatingCoolingState.OFF);
      return;
    }

    const mode = {
      auto: this.CurrentHeatingCoolingState.COOL,
      wind: this.CurrentHeatingCoolingState.COOL,
      hot: this.CurrentHeatingCoolingState.HEAT,
      cold: this.CurrentHeatingCoolingState.COOL,
    }[data?.mode ?? "hot"];
    this.debug(
      "[UPDATE] %s",
      mode === this.CurrentHeatingCoolingState.HEAT ? "HEAT" : "COOL",
    );
    this.accessory.setCharacteristic(
      this.homekitCharacteristic,
      mode,
      !callback,
    );
    callback && callback(null, mode);
  }
}
