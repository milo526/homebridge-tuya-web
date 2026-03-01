import { ClimateMode, ColorModes } from "../accessories/characteristics";
import { TuyaDeviceDefaults } from "../config";

export type ExtendedBoolean = boolean | "true" | "false" | "True" | "False";

type TuyaProperties = Partial<{
  brightness: number | string;
  color: Partial<{ hue: string; saturation: string; brightness: string }>;
  color_mode: ColorModes;
  color_temp: number | string;
  current_temperature: number | string;
  max_temper: number | string;
  min_temper: number | string;
  mode: ClimateMode;
  online: ExtendedBoolean;
  speed: number | string;
  speed_level: number | string;
  state: ExtendedBoolean | CoverState;
  support_stop: ExtendedBoolean;
  temperature: number | string;
}>;

type CustomProperties = Partial<{
  target_cover_state: CoverState;
}>;
export type DeviceState = TuyaProperties & CustomProperties;

export enum CoverState {
  Opening = 1,
  Closing = 2,
  Stopped = 3,
}

export const TuyaDeviceTypes = [
  "climate",
  "cover",
  "dimmer",
  "fan",
  "garage",
  "light",
  "outlet",
  "scene",
  "switch",
  "temperature_sensor",
  "window",
] as const;
export type TuyaDeviceType = (typeof TuyaDeviceTypes)[number];

export const HomeAssistantDeviceTypes = [
  "climate",
  "cover",
  "dimmer",
  "fan",
  "light",
  "outlet",
  "scene",
  "switch",
] as const;
export type HomeAssistantDeviceType = (typeof HomeAssistantDeviceTypes)[number];

export interface TuyaDevice {
  data: DeviceState;
  name: string;
  id: string;
  dev_type: TuyaDeviceType;
  ha_type: HomeAssistantDeviceType;
  config?: Partial<TuyaDeviceDefaults> & { old_dev_type: TuyaDeviceType };
}

export type TuyaApiMethod =
  | "brightnessSet"
  | "colorSet"
  | "colorTemperatureSet"
  | "modeSet"
  | "startStop"
  | "temperatureSet"
  | "turnOnOff"
  | "windSpeedSet";
export type TuyaApiPayload<Method extends TuyaApiMethod> =
  Method extends "brightnessSet"
    ? { value: number }
    : Method extends "colorSet"
    ? { color: { hue: number; saturation: number; brightness: number } }
    : Method extends "colorTemperatureSet"
    ? { value: number }
    : Method extends "modeSet"
    ? { value: ClimateMode }
    : Method extends "startStop"
    ? { value: 0 }
    : Method extends "temperatureSet"
    ? { value: number }
    : Method extends "turnOnOff"
    ? { value: 0 | 1 }
    : Method extends "windSpeedSet"
    ? { value: number }
    : never;

/**
 * Maps Tuya device categories to our internal device types.
 * See: https://developer.tuya.com/en/docs/iot/standarddescription?id=K9i5ql6waswzq
 */
export const CATEGORY_TO_DEV_TYPE: Record<string, TuyaDeviceType> = {
  // Lights
  dj: "light",
  dd: "light",
  xdd: "light",
  fwd: "light",
  dc: "light",
  gyd: "light",
  tyndj: "light",
  // Switches
  kg: "switch",
  tdq: "outlet",
  pc: "outlet",
  cz: "outlet",
  // Fans
  fs: "fan",
  fsd: "fan",
  // Covers
  cl: "cover",
  clkg: "cover",
  // Climate
  wk: "climate",
  kt: "climate",
  // Garage
  ckmkzq: "garage",
  // Temperature sensors
  wsdcg: "temperature_sensor",
  ldcg: "temperature_sensor",
  // Dimmers
  tgq: "dimmer",
  // Windows
  mc: "window",
};

export const DEV_TYPE_TO_HA_TYPE: Record<TuyaDeviceType, HomeAssistantDeviceType> = {
  climate: "climate",
  cover: "cover",
  dimmer: "dimmer",
  fan: "fan",
  garage: "switch",
  light: "light",
  outlet: "outlet",
  scene: "scene",
  switch: "switch",
  temperature_sensor: "switch",
  window: "cover",
};

/**
 * Metadata stored per device for translating between old method-based
 * API and new instruction-code-based API.
 */
export interface DeviceCodeMapping {
  category: string;
  devType: TuyaDeviceType;
  switchCode: string;
  brightnessCode?: string;
  colourCode?: string;
  tempValueCode?: string;
  workModeCode?: string;
  fanSpeedCode?: string;
  controlCode?: string;
}
