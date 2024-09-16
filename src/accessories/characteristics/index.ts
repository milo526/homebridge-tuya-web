import { ActiveCharacteristic } from "./active";
import { BrightnessCharacteristic } from "./brightness";
import { ColorTemperatureCharacteristic } from "./colorTemperature";
import { CurrentDoorStateCharacteristic } from "./currentDoorState";
import { CurrentHeatingCoolingStateCharacteristic } from "./currentHeatingCoolingState";
import { CurrentPositionCharacteristic } from "./currentPosition";
import { CurrentTemperatureCharacteristic } from "./currentTemperature";
import { HoldPositionCharacteristic } from "./holdPosition";
import { HueCharacteristic } from "./hue";
import { MomentaryOnCharacteristic } from "./momentaryOn";
import { ObstructionDetectedCharacteristic } from "./obstructionDetected";
import { OnCharacteristic } from "./on";
import { PositionStateCharacteristic } from "./positionState";
import { RotationSpeedCharacteristic } from "./rotationSpeed";
import { SaturationCharacteristic } from "./saturation";
import { TargetDoorStateCharacteristic } from "./targetDoorState";
import { TargetHeatingCoolingStateCharacteristic } from "./targetHeatingCoolingState";
import { TargetPositionCharacteristic } from "./targetPosition";
import { TargetTemperatureCharacteristic } from "./targetTemperature";
import { TemperatureDisplayUnitsCharacteristic } from "./temperatureDisplayUnits";

export * from "./active";
export * from "./brightness";
export * from "./colorTemperature";
export * from "./currentDoorState";
export * from "./currentHeatingCoolingState";
export * from "./currentPosition";
export * from "./currentTemperature";
export * from "./hue";
export * from "./momentaryOn";
export * from "./obstructionDetected";
export * from "./on";
export * from "./positionState";
export * from "./rotationSpeed";
export * from "./saturation";
export * from "./targetDoorState";
export * from "./targetHeatingCoolingState";
export * from "./targetPosition";
export * from "./targetTemperature";
export * from "./temperatureDisplayUnits";

export const COLOR_MODES = ["color", "colour"] as const;
export type ColorModes = (typeof COLOR_MODES)[number] | "white";

export const CLIMATE_MODES = ["cold", "hot", "wind", "auto"] as const;
export type ClimateMode = (typeof CLIMATE_MODES)[number];

export type GeneralCharacteristic =
  | typeof ActiveCharacteristic
  | typeof BrightnessCharacteristic
  | typeof ColorTemperatureCharacteristic
  | typeof CurrentDoorStateCharacteristic
  | typeof CurrentHeatingCoolingStateCharacteristic
  | typeof CurrentPositionCharacteristic
  | typeof CurrentTemperatureCharacteristic
  | typeof HoldPositionCharacteristic
  | typeof MomentaryOnCharacteristic
  | typeof ObstructionDetectedCharacteristic
  | typeof OnCharacteristic
  | typeof PositionStateCharacteristic
  | typeof RotationSpeedCharacteristic
  | typeof TargetDoorStateCharacteristic
  | typeof TargetHeatingCoolingStateCharacteristic
  | typeof TargetPositionCharacteristic
  | typeof TargetTemperatureCharacteristic
  | typeof TemperatureDisplayUnitsCharacteristic;

export type ColorCharacteristic =
  | typeof HueCharacteristic
  | typeof SaturationCharacteristic;

export type Characteristic = GeneralCharacteristic | ColorCharacteristic;
