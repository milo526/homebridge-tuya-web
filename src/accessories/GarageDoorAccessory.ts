import { HomebridgeAccessory, TuyaWebPlatform } from "../platform";
import { Categories } from "homebridge";
import {
  CurrentDoorStateCharacteristic,
  GeneralCharacteristic,
  ObstructionDetectedCharacteristic,
  TargetDoorStateCharacteristic,
} from "./characteristics";
import { BaseAccessory } from "./BaseAccessory";
import { TuyaDevice } from "../api/response";

export class GarageDoorAccessory extends BaseAccessory {
  constructor(
    platform: TuyaWebPlatform,
    homebridgeAccessory: HomebridgeAccessory | undefined,
    deviceConfig: TuyaDevice,
  ) {
    super(
      platform,
      homebridgeAccessory,
      deviceConfig,
      Categories.GARAGE_DOOR_OPENER,
    );
  }

  public get accessorySupportedCharacteristics(): GeneralCharacteristic[] {
    return [
      CurrentDoorStateCharacteristic,
      ObstructionDetectedCharacteristic,
      TargetDoorStateCharacteristic,
    ];
  }

  public get requiredCharacteristics(): GeneralCharacteristic[] {
    return [
      CurrentDoorStateCharacteristic,
      ObstructionDetectedCharacteristic,
      TargetDoorStateCharacteristic,
    ];
  }
}
