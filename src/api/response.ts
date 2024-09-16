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

export interface TuyaRequestHeader {
  name: "Discovery" | "QueryDevice" | TuyaApiMethod;
  namespace: "discovery" | "query" | "control";
  payloadVersion: 1;
}

export interface TuyaResponseHeader {
  /* eslint-disable @typescript-eslint/no-redundant-type-constituents */
  code:
    | "FrequentlyInvoke"
    | "SUCCESS"
    | "TargetOffline"
    | "UnsupportedOperation"
    | string;
  /* eslint-enable @typescript-eslint/no-redundant-type-constituents */
  payloadVersion: 1;
  msg?: string;
}

export interface DiscoveryPayload {
  payload: {
    devices: TuyaDevice[];
  };
  header: TuyaResponseHeader;
}

export interface DeviceQueryPayload {
  payload: {
    data: DeviceState;
  };
  header: TuyaResponseHeader;
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
