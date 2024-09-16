import { HomebridgeAccessory, TuyaWebPlatform } from "../platform";
import { Categories } from "homebridge";
import {
  BrightnessCharacteristic,
  Characteristic,
  ColorTemperatureCharacteristic,
  GeneralCharacteristic,
  HueCharacteristic,
  OnCharacteristic,
  SaturationCharacteristic,
} from "./characteristics";
import { ColorAccessory } from "./ColorAccessory";
import { TuyaDevice } from "../api/response";

export class LightAccessory extends ColorAccessory {
  constructor(
    platform: TuyaWebPlatform,
    homebridgeAccessory: HomebridgeAccessory | undefined,
    deviceConfig: TuyaDevice,
  ) {
    super(platform, homebridgeAccessory, deviceConfig, Categories.LIGHTBULB);
  }

  public get accessorySupportedCharacteristics(): Characteristic[] {
    return [
      OnCharacteristic,
      BrightnessCharacteristic,
      ColorTemperatureCharacteristic,
      HueCharacteristic,
      SaturationCharacteristic,
    ];
  }

  public get requiredCharacteristics(): Characteristic[] {
    return [OnCharacteristic];
  }

  public get deviceSupportedCharacteristics(): GeneralCharacteristic[] {
    // Get supported characteristics from configuration
    if (Array.isArray(this.deviceConfig.config?.light_characteristics)) {
      const supportedCharacteristics: GeneralCharacteristic[] = [];
      const configuredCharacteristics =
        this.deviceConfig.config?.light_characteristics ?? [];
      if (configuredCharacteristics.includes("Brightness")) {
        supportedCharacteristics.push(BrightnessCharacteristic);
      }

      if (configuredCharacteristics.includes("Color")) {
        supportedCharacteristics.push(HueCharacteristic);
        supportedCharacteristics.push(SaturationCharacteristic);
      }

      if (configuredCharacteristics.includes("Color Temperature")) {
        supportedCharacteristics.push(ColorTemperatureCharacteristic);
      }

      return supportedCharacteristics;
    }

    return super.deviceSupportedCharacteristics;
  }
}
