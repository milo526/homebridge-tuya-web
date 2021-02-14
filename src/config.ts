import { PlatformConfig } from "homebridge";
import { TuyaPlatform } from "./api/platform";
import { TuyaDeviceType } from "./api/response";

export type TuyaDeviceDefaults = {
  id: string;
  device_type: TuyaDeviceType;
  max_brightness: number;
  min_temper: string | number;
  max_temper: string | number;
  current_temperature_factor: string | number;
  target_temperature_factor: string | number;
  dimmer_characteristics: "Brightness"[];
  fan_characteristics: "Speed"[];
  light_characteristics: ("Brightness" | "Color" | "Color Temperature")[];
  cover_characteristics: "Stop"[];
};

type Config = {
  options?: {
    username?: string;
    password?: string;
    countryCode?: string;
    platform?: TuyaPlatform;
    pollingInterval?: number;
  };
  defaults?: Partial<TuyaDeviceDefaults>[];
  scenes?: boolean | string[];
};

export type TuyaWebConfig = PlatformConfig & Config;
