import { BaseAccessory } from "./BaseAccessory";
import { HomebridgeAccessory, TuyaWebPlatform } from "../platform";
import { Categories } from "homebridge";
import {
  BrightnessCharacteristic,
  GeneralCharacteristic,
  OnCharacteristic,
} from "./characteristics";
import { TuyaDevice } from "../api/response";
import { TuyaDeviceDefaults } from "../config";

export class DimmerAccessory extends BaseAccessory {
  constructor(
    platform: TuyaWebPlatform,
    homebridgeAccessory: HomebridgeAccessory,
    deviceConfig: TuyaDevice
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
        (this.deviceConfig.config?.dimmer_characteristics || []).includes(
          "Brightness"
        )
      ) {
        supportedCharacteristics.push(BrightnessCharacteristic);
      }

      return supportedCharacteristics;
    }

    return super.deviceSupportedCharacteristics;
  }

  validateConfigOverwrites(config: TuyaDeviceDefaults): string[] {
    const errors = super.validateConfigOverwrites(config);
    if (config?.max_brigthness) {
      const maxBrigthness = Number(config.max_brigthness);
      if (!maxBrigthness) {
        errors.push(
          "Wrong value configured for `max_brigthness`, should be a number"
        );
      } else {
        config.max_brigthness = maxBrigthness;
      }
    }
    return errors;
  }
}
