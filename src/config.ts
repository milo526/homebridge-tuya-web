import { PlatformConfig } from "homebridge";
import { TuyaPlatform } from "./api/platform";
import { TuyaDeviceType } from "./api/response";

export interface TuyaDeviceDefaults {
  id: string;
  device_type: TuyaDeviceType;
  min_temper: string | number;
  max_temper: string | number;
  current_temperature_factor: string | number;
  target_temperature_factor: string | number;
  dimmer_characteristics: "Brightness"[];
  fan_characteristics: "Speed"[];
  light_characteristics: ("Brightness" | "Color" | "Color Temperature")[];
  cover_characteristics: "Stop"[];
  min_brightness: string | number;
  max_brightness: string | number;
  min_kelvin: string | number;
  max_kelvin: string | number;
}

interface Config {
  options?: {
    username?: string;
    password?: string;
    countryCode?: string;
    platform?: TuyaPlatform;
    pollingInterval?: number;
  };
  defaults?: Partial<TuyaDeviceDefaults>[];
  scenes?: boolean | string[];
}

export type TuyaWebConfig = PlatformConfig & Config;
