import { HomebridgeAccessory, TuyaWebPlatform } from "../platform";
import { Categories } from "homebridge";
import {
  CurrentTemperatureCharacteristic,
  GeneralCharacteristic,
} from "./characteristics";
import { BaseAccessory } from "./BaseAccessory";
import { TuyaDeviceDefaults } from "../config";
import { TuyaDevice } from "../api/response";

export class TemperatureSensorAccessory extends BaseAccessory {
  constructor(
    platform: TuyaWebPlatform,
    homebridgeAccessory: HomebridgeAccessory | undefined,
    deviceConfig: TuyaDevice,
  ) {
    super(platform, homebridgeAccessory, deviceConfig, Categories.SENSOR);
  }

  public get currentTemperatureFactor(): number {
    if (this.deviceConfig.config?.current_temperature_factor) {
      return Number(this.deviceConfig.config.current_temperature_factor);
    }

    return 1;
  }

  validateConfigOverwrites(config: TuyaDeviceDefaults): string[] {
    const errors = super.validateConfigOverwrites(config);

    if (config?.current_temperature_factor) {
      const tempFactor = Number(config.current_temperature_factor);
      if (!tempFactor) {
        errors.push(
          "Wrong value configured for `current_temperature_factor`, should be a number",
        );
      } else {
        config.current_temperature_factor = tempFactor;
      }
    }

    return errors;
  }

  public get accessorySupportedCharacteristics(): GeneralCharacteristic[] {
    return [CurrentTemperatureCharacteristic];
  }

  public get requiredCharacteristics(): GeneralCharacteristic[] {
    return [CurrentTemperatureCharacteristic];
  }
}
