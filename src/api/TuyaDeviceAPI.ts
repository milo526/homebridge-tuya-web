/**
 * Tuya Device API
 * 
 * Handles device discovery and control using Tuya OpenAPI.
 */

import { TuyaOpenAPI } from './TuyaOpenAPI';
import { TuyaMobileAPI } from './TuyaMobileAPI';
import type { Logger } from 'homebridge';

export interface TuyaDevice {
  id: string;
  name: string;
  uid: string;
  local_key: string;
  category: string;
  product_id: string;
  product_name: string;
  sub: boolean; // Is this a sub-device?
  uuid: string;
  owner_id: string;
  online: boolean;
  status: TuyaDeviceStatus[];
  time_zone: string;
  ip: string;
  create_time: number;
  update_time: number;
  active_time: number;
  icon: string;
  model: string;
}

export interface TuyaDeviceStatus {
  code: string;
  value: boolean | number | string;
}

export interface TuyaDeviceCommand {
  code: string;
  value: boolean | number | string | Record<string, unknown>;
}

// Device category mapping to HomeKit accessory types
export const DEVICE_CATEGORIES = {
  // Lights
  dj: 'light',           // Light
  dd: 'light',           // Light strip
  fwd: 'light',          // Ambient light
  dc: 'light',           // Light string
  xdd: 'light',          // Ceiling light
  fsd: 'light',          // Ceiling fan light
  
  // Switches & Outlets
  kg: 'switch',          // Switch
  cz: 'outlet',          // Socket/outlet
  pc: 'outlet',          // Power strip
  
  // Climate
  kt: 'thermostat',      // Air conditioner
  wk: 'thermostat',      // Thermostat
  rs: 'heater',          // Heater
  
  // Fans
  fs: 'fan',             // Fan
  fskg: 'fan',           // Ceiling fan with light (fan mode)
  
  // Sensors
  pir: 'motion_sensor',  // PIR sensor
  mcs: 'contact_sensor', // Door/window sensor
  wsdcg: 'temp_sensor',  // Temp/humidity sensor
  ywbj: 'smoke_sensor',  // Smoke detector
  rqbj: 'gas_sensor',    // Gas detector
  sj: 'leak_sensor',     // Water leak sensor
  
  // Covers
  cl: 'cover',           // Curtain
  clkg: 'cover',         // Curtain switch
  ckmkzq: 'cover',       // Garage door
  
  // Other
  sp: 'camera',          // Camera
  bh: 'humidifier',      // Humidifier
  cs: 'dehumidifier',    // Dehumidifier
  xxj: 'air_purifier',   // Air purifier
} as const;

export type DeviceCategory = keyof typeof DEVICE_CATEGORIES;
export type AccessoryType = typeof DEVICE_CATEGORIES[DeviceCategory];

export class TuyaDeviceAPI {
  constructor(
    private readonly api: TuyaOpenAPI,
    private readonly mobileApi?: TuyaMobileAPI,
    private readonly log?: Logger,
  ) {}

  /**
   * Get all devices for the authenticated user
   */
  public async getDeviceList(): Promise<TuyaDevice[]> {
    const tokens = this.api.getTokens();
    
    this.log?.debug('Checking Mobile API availability...');
    if (this.mobileApi) {
      const mobileTokens = this.mobileApi.getTokens();
      this.log?.debug('Mobile API instance present. Tokens:', mobileTokens ? 'Yes' : 'No');
      if (mobileTokens) {
        this.log?.debug('Mobile Tokens:', JSON.stringify(mobileTokens));
        return this.getDeviceListMobile();
      }
    } else {
      this.log?.debug('Mobile API instance is UNDEFINED');
    }

    if (!tokens?.uid) {
      throw new Error('No authenticated user. Please link your account first.');
    }

    const response = await this.api.request<TuyaDevice[]>(
      `/v1.0/users/${tokens.uid}/devices`,
      'GET',
    );

    if (!response.success || !response.result) {
      throw new Error(`Failed to get device list: ${response.msg}`);
    }

    this.log?.debug('Found', response.result.length, 'devices');

    return response.result;
  }

  /**
   * Get devices using Mobile API (HA flow)
   * Steps: 1. Get Homes 2. Get Devices for each Home
   */
  private async getDeviceListMobile(): Promise<TuyaDevice[]> {
    this.log?.debug('Using Mobile API for device discovery');
    
    // 1. Query Homes
    const homeResponse = await this.mobileApi!.request<unknown[]>(
      '/v1.0/m/life/users/homes',
      'GET',
    );
    
    if (!homeResponse.success || !homeResponse.result) {
      throw new Error(`Failed to get homes: ${homeResponse.msg}`);
    }
    
    const homes = homeResponse.result as { homeId?: string; ownerId?: string }[];
    this.log?.debug(`Found ${homes.length} homes`);
    
    let allDevices: TuyaDevice[] = [];
    
    // 2. Query Devices for each home
    for (const home of homes) {
      const homeId = home.homeId || home.ownerId; // SDK uses ownerId as homeId usage?
      // SDK: _home = SmartLifeHome(str(home["ownerId"]), home["name"])
      // query_devices_by_home(home_id) calls /v1.0/m/life/ha/home/devices with homeId param
       
      const devResponse = await this.mobileApi!.request<unknown[]>(
        '/v1.0/m/life/ha/home/devices',
        'GET',
        { homeId: homeId }, 
      );
       
      if (devResponse.success && devResponse.result) {
        // Map to TuyaDevice if needed, but the structure is likely similar enough or needs adaptation using CustomerDevice class reference logic
        // For now, let's assume result confirms to TuyaDevice roughly.
        // SDK CustomerDevice has id, name, local_key, ... matches well.
        allDevices = allDevices.concat(devResponse.result as TuyaDevice[]);
      }
    }
    
    return allDevices;
  }

  /**
   * Helper to get status via Mobile API (reusing detail endpoint)
   */
  private async getDeviceStatusMobile(deviceId: string): Promise<TuyaDeviceStatus[]> {
    const response = await this.mobileApi!.request<unknown>(
      '/v1.0/m/life/ha/devices/detail',
      'GET',
      { devIds: deviceId },
    );

    if (!response.success || !response.result || !Array.isArray(response.result) || response.result.length === 0) {
      throw new Error(`Failed to get device status (Mobile): ${response.msg}`);
    }
      
    const device = response.result[0];
    // Map status object to array if needed?
    // SDK `_query_devices` logic:
    // device.status is array in response? 
    // SDK: for item_status in device.status: code=..., value=...
    // So response has status as array of objs with code/value.
    // This matches TuyaDeviceStatus[].
      
    return device.status as TuyaDeviceStatus[];
  }

  /**
   * Get the current status of a device
   */
  public async getDeviceStatus(deviceId: string): Promise<TuyaDeviceStatus[]> {
    if (this.mobileApi && this.mobileApi.getTokens()) {
      const response = await this.mobileApi.request<unknown>( // Typings for Mobile API result?
        `/v1.0/m/life/devices/${deviceId}/status`,
        'GET',
      );
      // Status format might be different for Mobile API? 
      // SDK `update_device_strategy_info` gets status, result contains "dpStatusRelationDTOS"?
      // But standard Open API `v1.0/devices/{id}/status` returns Simple list.
      // Let's assume for now and debug if it fails.
      // Wait, SDK: result = response.get("result", {}) -> "dpStatusRelationDTOS". 
      // This looks more like specification/strategy.
      // Re-read SDK carefully. 
      // `update_device_strategy_info` uses endpoint `/v1.0/m/life/devices/${device_id}/status`
      // But `query_devices_by_home` result has `status` property already!
      // Maybe we don't need a separate call if we just listed?
      // But for polling we need it.
      
      // Let's look at `query_devices_by_ids`
      // It calls `/v1.0/m/life/ha/devices/detail`. 
      
      // If we want status, maybe just use details endpoint?
      // Let's use `/v1.0/m/life/devices/${deviceId}/status` as per SDK `update_device_strategy_info` but check result format.
      // Actually `TuyaDevice` interface has `status` field.
      
      if (!response.success || !response.result) {
        throw new Error(`Failed to get device status (Mobile): ${response.msg}`);
      }
      
      // The result of `device status strategy` in SDK seems complex.
      // Let's try `v1.0/m/life/ha/devices/detail` instead for status?
      // SDK `query_devices_by_ids` returns list of devices with status.
      // That seems safer mapping.
      
      return this.getDeviceStatusMobile(deviceId);
    }

    const response = await this.api.request<TuyaDeviceStatus[]>(
      `/v1.0/devices/${deviceId}/status`,
      'GET',
    );

    if (!response.success || !response.result) {
      throw new Error(`Failed to get device status: ${response.msg}`);
    }

    return response.result;
  }

  /**
   * Get detailed device information
   */
  public async getDeviceInfo(deviceId: string): Promise<TuyaDevice> {
    if (this.mobileApi && this.mobileApi.getTokens()) {
      // Use device detail endpoint
      // SDK: query_devices_by_ids -> /v1.0/m/life/ha/devices/detail
      const response = await this.mobileApi.request<unknown>(
        '/v1.0/m/life/ha/devices/detail',
        'GET',
        { devIds: deviceId },
      );
       
      if (!response.success || !response.result || !Array.isArray(response.result)) {
        throw new Error(`Failed to get device info (Mobile): ${response.msg}`);
      }
      return response.result[0] as TuyaDevice;
    }

    const response = await this.api.request<TuyaDevice>(
      `/v1.0/devices/${deviceId}`,
      'GET',
    );

    if (!response.success || !response.result) {
      throw new Error(`Failed to get device info: ${response.msg}`);
    }

    return response.result;
  }

  /**
   * Send commands to a device
   */
  public async sendCommands(deviceId: string, commands: TuyaDeviceCommand[]): Promise<boolean> {
    if (this.mobileApi && this.mobileApi.getTokens()) {
      // SDK: send_commands -> /v1.1/m/thing/${device_id}/commands
      const response = await this.mobileApi.request<boolean>(
        `/v1.1/m/thing/${deviceId}/commands`,
        'POST',
        {},
        { commands },
      );
      
      if (!response.success) {
        throw new Error(`Failed to send commands (Mobile): ${response.msg}`);
      }
      return response.result ?? true;
    }

    const response = await this.api.request<boolean>(
      `/v1.0/devices/${deviceId}/commands`,
      'POST',
      { commands },
    );

    if (!response.success) {
      throw new Error(`Failed to send commands: ${response.msg}`);
    }

    return response.result ?? true;
  }

  /**
   * Turn a device on or off
   */
  public async setDevicePower(deviceId: string, on: boolean): Promise<boolean> {
    const status = await this.getDeviceStatus(deviceId);
    const code = status.some(s => s.code === 'switch_led') ? 'switch_led' : 'switch_1';
    return this.sendCommands(deviceId, [{ code, value: on }]);
  }

  /**
   * Set brightness (for lights)
   */
  public async setBrightness(deviceId: string, brightness: number): Promise<boolean> {
    // Check supported codes
    const status = await this.getDeviceStatus(deviceId);
    
    // Check for V2 first (scale 0-1000)
    if (status.some(s => s.code === 'bright_value_v2')) {
      // Tuya uses 10-1000 scale for brightness V2
      const value = Math.round(brightness * 10);
      return this.sendCommands(deviceId, [{ code: 'bright_value_v2', value }]);
    }
    
    // Check for V1 (scale 0-255)
    if (status.some(s => s.code === 'bright_value')) {
      // Tuya uses 0-255 scale for brightness V1 (min 25 typically)
      const value = Math.round((brightness / 100) * 255);
      // Ensure value is within range
      const clamped = Math.max(25, Math.min(255, value));
      return this.sendCommands(deviceId, [{ code: 'bright_value', value: clamped }]);
    }
    
    throw new Error('Device does not support known brightness codes');
  }

  /**
   * Set color temperature (for lights, in Kelvin)
   */
  public async setColorTemperature(deviceId: string, kelvin: number): Promise<boolean> {
    const status = await this.getDeviceStatus(deviceId);
    
    // Check for V2 (0-1000)
    if (status.some(s => s.code === 'temp_value_v2')) {
      const ratio = Math.max(0, Math.min(1, (kelvin - 2700) / (6500 - 2700)));
      const value = Math.round(ratio * 1000);
      return this.sendCommands(deviceId, [{ code: 'temp_value_v2', value }]);
    }
    
    // Check for V1 (0-255)
    if (status.some(s => s.code === 'temp_value')) {
      const ratio = Math.max(0, Math.min(1, (kelvin - 2700) / (6500 - 2700)));
      const value = Math.round(ratio * 255);
      return this.sendCommands(deviceId, [{ code: 'temp_value', value }]);
    }
    
    // Warning: some devices use specific ranges, need improved handling if this fails
    return false;
  }

  /**
   * Set HSV color (for RGB lights)
   * @param h Hue 0-360
   * @param s Saturation 0-100
   * @param v Value/Brightness 0-100
   */
  public async setColor(deviceId: string, h: number, s: number, v: number): Promise<boolean> {
    const status = await this.getDeviceStatus(deviceId);

    // Check for V2 (0-1000)
    if (status.some(st => st.code === 'colour_data_v2')) {
      // Tuya V2 expects: h (0-360), s (0-1000), v (0-1000)
      // Value should be an object, not a JSON string (per Tuya docs)
      const colorValue = {
        h: Math.round(h),           // 0-360
        s: Math.round(s * 10),      // 0-100 -> 0-1000
        v: Math.round(v * 10),      // 0-100 -> 0-1000
      };
      return this.sendCommands(deviceId, [
        { code: 'colour_data_v2', value: colorValue },
      ]);
    }

    // Check for V1 (0-255)
    if (status.some(st => st.code === 'colour_data')) {
      // Tuya V1 expects: h (0-360), s (0-255), v (0-255)
      const colorValue = {
        h: Math.max(1, Math.min(360, Math.round(h))), // min 1
        s: Math.max(0, Math.min(255, Math.round((s / 100) * 255))),
        v: Math.max(0, Math.min(255, Math.round((v / 100) * 255))),
      };
      return this.sendCommands(deviceId, [
        { code: 'colour_data', value: colorValue },
      ]);
    }
    
    return false;
  }

  /**
   * Get the accessory type for a device category
   */
  public getAccessoryType(category: string): AccessoryType | undefined {
    return DEVICE_CATEGORIES[category as DeviceCategory];
  }
}
