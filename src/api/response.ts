/**
 * API Response Types
 * 
 * Bridge types to support the old accessory system with the new API.
 * Converts between the old DeviceState format and new TuyaDeviceStatus[] format.
 */

import { TuyaDeviceStatus, TuyaDevice as NewTuyaDevice } from './TuyaDeviceAPI';

// Re-export for convenience
export { TuyaDeviceStatus };

/**
 * Extended boolean type that handles Tuya's various boolean representations
 */
export type ExtendedBoolean = boolean | 'true' | 'false' | '1' | '0' | 1 | 0;

/**
 * Cover/Window state enum
 */
export enum CoverState {
  Opening = 1,
  Closing = 2,
  Stopped = 3,
}

/**
 * Color data structure from Tuya
 */
export interface TuyaColorData {
  hue?: string;
  saturation?: string;
  brightness?: string;
  h?: number;
  s?: number;
  v?: number;
}

/**
 * Device state in the old format (used by accessories)
 * This is what the old characteristic handlers expect
 */
export interface DeviceState {
  online?: ExtendedBoolean;
  state?: ExtendedBoolean | number | string;
  brightness?: number | string;
  color_mode?: string;
  color?: TuyaColorData;
  color_temp?: number | string;
  speed?: number | string;
  speed_level?: number | string;
  // Climate
  temp_current?: number | string;
  temp_set?: number | string;
  temperature?: number | string;
  current_temperature?: number | string;
  min_temper?: number | string;
  max_temper?: number | string;
  mode?: string;
  // Cover/Window
  position?: number | string;
  target_cover_state?: CoverState;
  support_stop?: ExtendedBoolean;
  // Garage door
  door_state?: string;
  // Generic value holder
  value?: unknown;
}

/**
 * TuyaDevice interface that works with the old accessory system
 * Extended from new API's TuyaDevice but includes old-style config and data
 */
export interface TuyaDevice extends Partial<NewTuyaDevice> {
  id: string;
  name: string;
  dev_type: string;
  ha_type?: string;
  icon?: string;
  data: DeviceState;
  config?: TuyaDeviceConfig;
  // New API fields that may be present
  category?: string;
  product_name?: string;
  online?: boolean;
  status?: TuyaDeviceStatus[];
}

/**
 * Per-device configuration options
 * Note: This extends TuyaDeviceDefaults from config.ts
 */
export interface TuyaDeviceConfig {
  id?: string;
  name?: string;
  device_type?: string;
  // Light options
  min_brightness?: number | string;
  max_brightness?: number | string;
  min_color_temp?: number | string;
  max_color_temp?: number | string;
  min_kelvin?: number | string;
  max_kelvin?: number | string;
  light_characteristics?: ('Brightness' | 'Color' | 'Color Temperature' | string)[];
  // Dimmer options
  dimmer_characteristics?: string[];
  // Fan options
  fan_characteristics?: ('Speed' | string)[];
  // Cover options
  cover_characteristics?: ('Position' | 'Stop' | string)[];
  // Climate options
  min_temp?: number | string;
  max_temp?: number | string;
  min_temper?: number | string;
  max_temper?: number | string;
  target_temperature_factor?: number | string;
  current_temperature_factor?: number | string;
  climate_mode?: string[];
  // Scene options
  scene?: boolean;
}

/**
 * API method names used by setDeviceState
 */
export type TuyaApiMethod = 
  | 'turnOnOff' 
  | 'brightnessSet' 
  | 'colorSet' 
  | 'colorTemperatureSet'
  | 'speedSet'
  | 'windSpeedSet'
  | 'setPosition'
  | 'setTemperature'
  | 'temperatureSet'
  | 'setMode'
  | 'modeSet'
  | 'startStop'
  | 'triggerScene';

/**
 * API payload types for each method
 */
export interface TuyaApiPayloads {
  turnOnOff: { value: 0 | 1 };
  brightnessSet: { value: number };
  colorSet: { color: { hue: number; saturation: number; brightness: number } };
  colorTemperatureSet: { value: number };
  speedSet: { value: number };
  windSpeedSet: { value: number };
  setPosition: { value: number };
  setTemperature: { value: number };
  temperatureSet: { value: number };
  setMode: { value: string };
  modeSet: { value: string };
  startStop: { value: 0 | 1 | 2 };
  triggerScene: Record<string, never>;
}

export type TuyaApiPayload<M extends TuyaApiMethod> = TuyaApiPayloads[M];

/**
 * Convert TuyaDeviceStatus[] array to DeviceState object
 */
export function statusArrayToDeviceState(status: TuyaDeviceStatus[], online?: boolean): DeviceState {
  const state: DeviceState = {
    online: online,
  };

  for (const s of status) {
    switch (s.code) {
      // Power/State
      case 'switch_led':
      case 'switch_1':
      case 'switch':
      case 'power':
      case 'on':
        state.state = s.value as ExtendedBoolean;
        break;

      // Brightness
      case 'bright_value_v2':
        state.brightness = Math.round((s.value as number) / 10);
        break;
      case 'bright_value':
        state.brightness = Math.round(((s.value as number) / 255) * 100);
        break;

      // Color temperature
      case 'temp_value_v2':
      case 'temp_value':
        state.color_temp = s.value as number;
        break;

      // Color mode
      case 'work_mode':
        state.color_mode = s.value as string;
        break;

      // Color data
      case 'colour_data_v2':
      case 'colour_data':
        try {
          const colorData = typeof s.value === 'string' ? JSON.parse(s.value) : s.value;
          state.color = {
            hue: String(colorData.h ?? colorData.hue ?? 0),
            saturation: String(colorData.s ?? colorData.saturation ?? 0),
            brightness: String(colorData.v ?? colorData.brightness ?? 100),
          };
          state.color_mode = 'colour';
        } catch {
          // Ignore parsing errors
        }
        break;

      // Fan speed
      case 'fan_speed_percent':
      case 'speed':
        state.speed = s.value as number;
        break;

      // Temperature
      case 'va_temperature':
      case 'temp_current':
        state.temp_current = s.value as number;
        break;
      case 'temp_set':
        state.temp_set = s.value as number;
        break;

      // Mode
      case 'mode':
        state.mode = s.value as string;
        break;

      // Position (covers)
      case 'percent_control':
      case 'position':
        state.position = s.value as number;
        break;
    }
  }

  return state;
}

/**
 * Convert new API TuyaDevice to old format TuyaDevice
 */
export function convertNewDeviceToOld(newDevice: NewTuyaDevice): TuyaDevice {
  const data = statusArrayToDeviceState(newDevice.status || [], newDevice.online);
  
  return {
    ...newDevice,
    dev_type: newDevice.category || 'switch',
    ha_type: mapCategoryToHaType(newDevice.category),
    data,
  };
}

/**
 * Map device category to ha_type (device type for accessory mapping)
 */
function mapCategoryToHaType(category?: string): string {
  const mapping: Record<string, string> = {
    // Lights
    'dj': 'light',
    'dd': 'light',
    'fwd': 'light',
    'dc': 'light',
    'xdd': 'light',
    'fsd': 'light',
    // Switches & Outlets
    'kg': 'switch',
    'cz': 'outlet',
    'pc': 'outlet',
    // Climate
    'kt': 'climate',
    'wk': 'climate',
    'rs': 'climate',
    // Fans
    'fs': 'fan',
    'fskg': 'fan',
    // Covers
    'cl': 'cover',
    'clkg': 'cover',
    'ckmkzq': 'garage',
    // Scenes
    'scene': 'scene',
  };

  return mapping[category || ''] || 'switch';
}
