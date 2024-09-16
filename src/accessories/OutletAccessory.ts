import { BaseAccessory } from "./BaseAccessory";
import { HomebridgeAccessory, TuyaWebPlatform } from "../platform";
import { Categories } from "homebridge";
import { GeneralCharacteristic, OnCharacteristic } from "./characteristics";
import { TuyaDevice } from "../api/response";

export class OutletAccessory extends BaseAccessory {
  constructor(
    platform: TuyaWebPlatform,
    homebridgeAccessory: HomebridgeAccessory | undefined,
    deviceConfig: TuyaDevice,
  ) {
    super(platform, homebridgeAccessory, deviceConfig, Categories.OUTLET);
  }

  public get accessorySupportedCharacteristics(): GeneralCharacteristic[] {
    return [OnCharacteristic];
  }

  public get requiredCharacteristics(): GeneralCharacteristic[] {
    return [OnCharacteristic];
  }
}
