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

  public get maxBrightness(): number {
    if (this.deviceConfig.config?.max_brightness) {
      return this.deviceConfig.config.max_brightness;
    }

    return 255;
  }

  public get minBrightness(): number {
    if (this.deviceConfig.config?.min_brightness) {
      return this.deviceConfig.config.min_brightness;
    }

    return 1;
  }

  validateConfigOverwrites(config: TuyaDeviceDefaults): string[] {
    const errors = super.validateConfigOverwrites(config);
    if (config?.max_brightness) {
      const maxBrightness = Number(config.max_brightness);
      if (!maxBrightness) {
        errors.push(
          "Wrong value configured for `max_brightness`, should be a number"
        );
      } else {
        config.max_brightness = maxBrightness;
      }
    }

    if (config?.min_brightness) {
      const minBrightness = Number(config.min_brightness);
      if (!minBrightness) {
        errors.push(
          "Wrong value configured for `min_brightness`, should be a number"
        );
      } else {
        config.min_brightness = minBrightness;
      }
    }
    return errors;
  }
}
