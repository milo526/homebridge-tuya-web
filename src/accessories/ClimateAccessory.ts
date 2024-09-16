import { HomebridgeAccessory, TuyaWebPlatform } from "../platform";
import { Categories } from "homebridge";
import {
  CurrentHeatingCoolingStateCharacteristic,
  CurrentTemperatureCharacteristic,
  GeneralCharacteristic,
  TargetHeatingCoolingStateCharacteristic,
  TargetTemperatureCharacteristic,
  TemperatureDisplayUnitsCharacteristic,
} from "./characteristics";
import { BaseAccessory } from "./BaseAccessory";
import { TuyaDeviceDefaults } from "../config";
import { TuyaDevice } from "../api/response";

export class ClimateAccessory extends BaseAccessory {
  constructor(
    platform: TuyaWebPlatform,
    homebridgeAccessory: HomebridgeAccessory | undefined,
    deviceConfig: TuyaDevice,
  ) {
    super(platform, homebridgeAccessory, deviceConfig, Categories.THERMOSTAT);
  }

  public get targetTemperatureFactor(): number {
    if (this.deviceConfig.config?.target_temperature_factor) {
      return Number(this.deviceConfig.config.target_temperature_factor);
    }

    return 1;
  }

  public get currentTemperatureFactor(): number {
    if (this.deviceConfig.config?.current_temperature_factor) {
      return Number(this.deviceConfig.config.current_temperature_factor);
    }

    return 1;
  }

  validateConfigOverwrites(config: TuyaDeviceDefaults): string[] {
    const errors = super.validateConfigOverwrites(config);
    if (config?.min_temper) {
      const minTemp = Number(config.min_temper);
      if (!minTemp) {
        errors.push(
          "Wrong value configured for `min_temper`, should be a number",
        );
      } else {
        //Ensure that the min temp is a multiple of 0.5;
        config.min_temper = Math.round(minTemp * 2) / 2;
      }
    }

    if (config?.max_temper) {
      const maxTemp = Number(config.max_temper);
      if (!maxTemp) {
        errors.push(
          "Wrong value configured for `max_temper`, should be a number",
        );
      } else {
        //Ensure that the min temp is a multiple of 0.5;
        config.max_temper = Math.round(maxTemp * 2) / 2;
      }
    }

    if (config?.target_temperature_factor) {
      const tempFactor = Number(config.target_temperature_factor);
      if (!tempFactor) {
        errors.push(
          "Wrong value configured for `target_temperature_factor`, should be a number",
        );
      } else {
        config.target_temperature_factor = tempFactor;
      }
    }

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

    if (errors.length) {
      //Return early to let users fix basic errors.
      return errors;
    }

    if (
      config?.min_temper &&
      config?.max_temper &&
      config.min_temper >= config.max_temper
    ) {
      errors.push(
        "The minimum temperature is larger then the maximum temperature",
      );
    }
    return errors;
  }

  public get accessorySupportedCharacteristics(): GeneralCharacteristic[] {
    return [
      CurrentTemperatureCharacteristic,
      TargetTemperatureCharacteristic,
      CurrentHeatingCoolingStateCharacteristic,
      TargetHeatingCoolingStateCharacteristic,
      TemperatureDisplayUnitsCharacteristic,
    ];
  }

  public get requiredCharacteristics(): GeneralCharacteristic[] {
    return [
      CurrentTemperatureCharacteristic,
      TargetTemperatureCharacteristic,
      CurrentHeatingCoolingStateCharacteristic,
      TargetHeatingCoolingStateCharacteristic,
      TemperatureDisplayUnitsCharacteristic,
    ];
  }
}
