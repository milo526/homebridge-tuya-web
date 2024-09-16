import { BaseAccessory } from "./BaseAccessory";
import { HomebridgeAccessory, TuyaWebPlatform } from "../platform";
import { Categories } from "homebridge";
import {
  BrightnessCharacteristic,
  GeneralCharacteristic,
  OnCharacteristic,
} from "./characteristics";
import { TuyaDevice } from "../api/response";

export class DimmerAccessory extends BaseAccessory {
  constructor(
    platform: TuyaWebPlatform,
    homebridgeAccessory: HomebridgeAccessory | undefined,
    deviceConfig: TuyaDevice,
  ) {
    super(platform, homebridgeAccessory, deviceConfig, Categories.LIGHTBULB);
  }

  public get accessorySupportedCharacteristics(): GeneralCharacteristic[] {
    return [OnCharacteristic, BrightnessCharacteristic];
  }

  public get requiredCharacteristics(): GeneralCharacteristic[] {
    return [OnCharacteristic];
  }

  public get deviceSupportedCharacteristics(): GeneralCharacteristic[] {
    // Get supported characteristics from configuration
    if (this.deviceConfig.config) {
      const supportedCharacteristics: GeneralCharacteristic[] = [];
      if (
        (this.deviceConfig.config?.dimmer_characteristics ?? []).includes(
          "Brightness",
        )
      ) {
        supportedCharacteristics.push(BrightnessCharacteristic);
      }

      return supportedCharacteristics;
    }

    return super.deviceSupportedCharacteristics;
  }
}
