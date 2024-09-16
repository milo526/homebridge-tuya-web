import { Characteristic, CharacteristicGetCallback } from "homebridge";
import { TuyaWebCharacteristic } from "./base";
import { BaseAccessory } from "../BaseAccessory";
import { ClimateAccessory } from "../ClimateAccessory";
import { DeviceState } from "../../api/response";

export class CurrentTemperatureCharacteristic extends TuyaWebCharacteristic {
  public static Title = "Characteristic.CurrentTemperature";

  public static HomekitCharacteristic(accessory: BaseAccessory) {
    return accessory.platform.Characteristic.CurrentTemperature;
  }

  public setProps(char?: Characteristic): Characteristic | undefined {
    //Roughly the coldest and hottest temperatures ever recorded on earth.
    return char?.setProps({
      minValue: -100,
      maxValue: 150,
    });
  }

  public static isSupportedByAccessory(accessory: BaseAccessory): boolean {
    return accessory.deviceConfig.data.current_temperature !== undefined;
  }

  public getRemoteValue(callback: CharacteristicGetCallback): void {
    this.accessory
      .getDeviceState()
      .then((data) => {
        this.debug("[GET] %s", data?.current_temperature);
        this.updateValue(data, callback);
      })
      .catch(this.accessory.handleError("GET", callback));
  }

  updateValue(data: DeviceState, callback?: CharacteristicGetCallback): void {
    let currentTemperature = data?.current_temperature
      ? Number(data?.current_temperature) *
        (this.accessory as ClimateAccessory).currentTemperatureFactor
      : undefined;
    if (currentTemperature) {
      currentTemperature = Math.round(currentTemperature * 10) / 10;

      this.debug("[UPDATE] %s", currentTemperature);
      this.accessory.setCharacteristic(
        this.homekitCharacteristic,
        currentTemperature,
        !callback,
      );
      callback && callback(null, currentTemperature);
    } else {
      callback && callback(new Error("Could not get temperature from data"));
    }
  }
}
