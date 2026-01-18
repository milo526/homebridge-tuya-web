/**
 * Configuration Types
 * 
 * Types for device and plugin configuration.
 */

/**
 * Default configuration options for Tuya devices
 */
export interface TuyaDeviceDefaults {
  id?: string;
  name?: string;
  device_type?: string;
  
  // Light characteristics
  min_brightness?: number | string;
  max_brightness?: number | string;
  min_color_temp?: number | string;
  max_color_temp?: number | string;
  min_kelvin?: number | string;
  max_kelvin?: number | string;
  light_characteristics?: LightCharacteristic[];
  
  // Dimmer characteristics
  dimmer_characteristics?: string[];
  
  // Fan characteristics
  fan_characteristics?: FanCharacteristic[];
  
  // Cover characteristics
  cover_characteristics?: CoverCharacteristic[];
  
  // Climate settings
  min_temp?: number | string;
  max_temp?: number | string;
  min_temper?: number | string;
  max_temper?: number | string;
  target_temperature_factor?: number | string;
  current_temperature_factor?: number | string;
  climate_mode?: ClimateMode[];
  
  // Scene options
  scene?: boolean;
}

/**
 * Light characteristic options
 */
export type LightCharacteristic = 'Brightness' | 'Color' | 'Color Temperature';

/**
 * Fan characteristic options
 */
export type FanCharacteristic = 'Speed';

/**
 * Cover characteristic options
 */
export type CoverCharacteristic = 'Position';

/**
 * Climate mode options
 */
export type ClimateMode = 'cold' | 'hot' | 'wind' | 'auto';
