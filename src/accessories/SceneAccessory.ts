import { BaseAccessory } from "./BaseAccessory";
import { HomebridgeAccessory, TuyaWebPlatform } from "../platform";
import { Categories } from "homebridge";
import {
  GeneralCharacteristic,
  MomentaryOnCharacteristic,
} from "./characteristics";
import { TuyaDevice } from "../api/response";

export class SceneAccessory extends BaseAccessory {
  constructor(
    platform: TuyaWebPlatform,
    homebridgeAccessory: HomebridgeAccessory | undefined,
    deviceConfig: TuyaDevice,
  ) {
    super(platform, homebridgeAccessory, deviceConfig, Categories.SWITCH);
  }

  public get accessorySupportedCharacteristics(): GeneralCharacteristic[] {
    return [MomentaryOnCharacteristic];
  }

  public get requiredCharacteristics(): GeneralCharacteristic[] {
    return [MomentaryOnCharacteristic];
  }
}
