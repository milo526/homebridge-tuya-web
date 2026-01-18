import { HomebridgeAccessory, TuyaWebPlatform } from "../platform";
import { Categories } from "homebridge";
import {
  CurrentPositionCharacteristic,
  GeneralCharacteristic,
  PositionStateCharacteristic,
  TargetPositionCharacteristic,
  HoldPositionCharacteristic,
} from "./characteristics";
import { BaseAccessory } from "./BaseAccessory";
import type { TuyaDevice } from "../api/response";

export class CoverAccessory extends BaseAccessory {
  constructor(
    platform: TuyaWebPlatform,
    homebridgeAccessory: HomebridgeAccessory | undefined,
    deviceConfig: TuyaDevice,
  ) {
    super(
      platform,
      homebridgeAccessory,
      deviceConfig,
      Categories.WINDOW_COVERING,
    );
  }

  public get accessorySupportedCharacteristics(): GeneralCharacteristic[] {
    return [
      CurrentPositionCharacteristic,
      HoldPositionCharacteristic,
      PositionStateCharacteristic,
      TargetPositionCharacteristic,
    ];
  }

  public get requiredCharacteristics(): GeneralCharacteristic[] {
    return [
      CurrentPositionCharacteristic,
      PositionStateCharacteristic,
      TargetPositionCharacteristic,
    ];
  }

  public get deviceSupportedCharacteristics(): GeneralCharacteristic[] {
    // Get supported characteristics from configuration
    if (Array.isArray(this.deviceConfig.config?.cover_characteristics)) {
      const supportedCharacteristics: GeneralCharacteristic[] = [];
      const configuredCharacteristics =
        this.deviceConfig.config?.cover_characteristics ?? [];
      if (configuredCharacteristics.includes("Stop")) {
        supportedCharacteristics.push(HoldPositionCharacteristic);
      }

      return supportedCharacteristics;
    }

    return super.deviceSupportedCharacteristics;
  }
}
