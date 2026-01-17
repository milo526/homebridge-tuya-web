/**
 * TuyaWebApi
 * 
 * Wrapper class that provides the old API interface expected by the accessories.
 * Bridges the old DeviceState-based API with the new TuyaDeviceStatus-based API.
 */

import type { Logger } from 'homebridge';
import { TuyaDeviceAPI, TuyaDeviceCommand } from './TuyaDeviceAPI';
import {
  DeviceState,
  TuyaDevice,
  TuyaApiMethod,
  TuyaApiPayload,
  statusArrayToDeviceState,
  convertNewDeviceToOld,
} from './response';
import { RateLimitError } from '../errors';

export class TuyaWebApi {
  private deviceCache: Map<string, TuyaDevice> = new Map();
  private lastRequestTime = 0;
  private minRequestInterval = 500; // ms between requests

  constructor(
    private readonly deviceApi: TuyaDeviceAPI,
    private readonly log?: Logger,
  ) {}

  /**
   * Get all devices for the authenticated user
   * Returns devices in the old TuyaDevice format
   */
  public async getAllDevices(): Promise<TuyaDevice[]> {
    this.log?.debug('[TuyaWebApi] Getting all devices');
    
    const devices = await this.deviceApi.getDeviceList();
    const oldDevices = devices.map(convertNewDeviceToOld);
    
    // Update cache
    for (const device of oldDevices) {
      this.deviceCache.set(device.id, device);
    }
    
    return oldDevices;
  }

  /**
   * Get the current state of a device
   */
  public async getDeviceState(deviceId: string): Promise<DeviceState> {
    this.log?.debug('[TuyaWebApi] Getting device state for:', deviceId);
    
    // Rate limiting
    await this.enforceRateLimit();
    
    const status = await this.deviceApi.getDeviceStatus(deviceId);
    const device = this.deviceCache.get(deviceId);
    
    return statusArrayToDeviceState(status, device?.online);
  }

  /**
   * Set device state using the old API method interface
   */
  public async setDeviceState<M extends TuyaApiMethod>(
    deviceId: string,
    method: M,
    payload: TuyaApiPayload<M>,
  ): Promise<void> {
    this.log?.debug(`[TuyaWebApi] Setting device state - ${method}:`, JSON.stringify(payload));
    
    // Convert old API method to new commands
    const commands = this.convertMethodToCommands(deviceId, method, payload);
    
    if (commands.length > 0) {
      this.log?.debug(`[TuyaWebApi] Sending commands:`, JSON.stringify(commands));
      await this.deviceApi.sendCommands(deviceId, commands);
    }
  }

  /**
   * Convert old API method calls to new command format
   */
  private convertMethodToCommands(
    deviceId: string,
    method: TuyaApiMethod,
    payload: unknown,
  ): TuyaDeviceCommand[] {
    const commands: TuyaDeviceCommand[] = [];
    const p = payload as Record<string, unknown>;

    switch (method) {
      case 'turnOnOff': {
        // Find the right switch code for this device
        const switchCode = this.getSwitchCode(deviceId);
        commands.push({ code: switchCode, value: p.value === 1 });
        break;
      }

      case 'brightnessSet': {
        // Check if device uses V2 or V1 brightness
        const device = this.deviceCache.get(deviceId);
        const usesV2 = device?.data?.brightness !== undefined && 
                       typeof device.data.brightness === 'number' &&
                       device.data.brightness > 100;
        
        if (usesV2) {
          // V2 uses 10-1000 scale
          commands.push({ code: 'bright_value_v2', value: Math.round(Number(p.value) * 10) });
        } else {
          // V1 uses 0-255 scale
          const scaledValue = Math.max(25, Math.min(255, Math.round((Number(p.value) / 100) * 255)));
          commands.push({ code: 'bright_value', value: scaledValue });
        }
        break;
      }

      case 'colorTemperatureSet': {
        // Input is in Kelvin, convert to Tuya scale
        // Tuya uses 0-1000 (V2) or 0-255 (V1), mapping 2700K-6500K
        const kelvin = Number(p.value);
        const ratio = Math.max(0, Math.min(1, (kelvin - 2700) / (6500 - 2700)));
        
        // Check if device uses V1 or V2
        const device = this.deviceCache.get(deviceId);
        const hasV2Temp = device?.status?.some(s => s.code === 'temp_value_v2');
        const hasV1Temp = device?.status?.some(s => s.code === 'temp_value');
        
        this.log?.debug(`[TuyaWebApi] colorTemperatureSet: kelvin=${kelvin}, ratio=${ratio}, V2=${hasV2Temp}, V1=${hasV1Temp}`);
        
        // Switch to white mode first
        commands.push({ code: 'work_mode', value: 'white' });
        
        if (hasV1Temp && !hasV2Temp) {
          // V1 scale: 0-255
          const v1Value = Math.round(ratio * 255);
          commands.push({ code: 'temp_value', value: v1Value });
        } else {
          // V2 scale: 0-1000
          const v2Value = Math.round(ratio * 1000);
          commands.push({ code: 'temp_value_v2', value: v2Value });
        }
        break;
      }

      case 'colorSet': {
        // Old API sends: hue (0-360), saturation (0-1 fraction), brightness (0-100 percentage)
        const color = p.color as { hue: number; saturation: number; brightness: number };
        
        this.log?.debug(`[TuyaWebApi] colorSet input: hue=${color.hue}, saturation=${color.saturation}, brightness=${color.brightness}`);
        
        // Check if device uses V1 or V2 based on cached data
        const device = this.deviceCache.get(deviceId);
        const hasV2Color = device?.status?.some(s => s.code === 'colour_data_v2');
        const hasV1Color = device?.status?.some(s => s.code === 'colour_data');
        
        this.log?.debug(`[TuyaWebApi] Device color support: V2=${hasV2Color}, V1=${hasV1Color}`);
        
        // Set work mode to color first
        commands.push({ code: 'work_mode', value: 'colour' });
        
        if (hasV1Color && !hasV2Color) {
          // V1 format: h (0-360), s (0-255), v (0-255)
          // Value should be an OBJECT, not a JSON string (per Tuya docs)
          const colorValueV1 = {
            h: Math.max(1, Math.round(color.hue)), // min 1 for V1
            s: Math.round(color.saturation * 255), // 0-1 -> 0-255
            v: Math.round((color.brightness / 100) * 255), // 0-100 -> 0-255
          };
          this.log?.debug(`[TuyaWebApi] colorSet V1 output:`, colorValueV1);
          commands.push({ code: 'colour_data', value: colorValueV1 });
        } else {
          // V2 format: h (0-360), s (0-1000), v (0-1000)
          // Value should be an OBJECT, not a JSON string (per Tuya docs)
          const colorValueV2 = {
            h: Math.round(color.hue),
            s: Math.round(color.saturation * 1000), // 0-1 -> 0-1000
            v: Math.round(color.brightness * 10),   // 0-100 -> 0-1000
          };
          this.log?.debug(`[TuyaWebApi] colorSet V2 output:`, colorValueV2);
          commands.push({ code: 'colour_data_v2', value: colorValueV2 });
        }
        break;
      }

      case 'speedSet':
      case 'windSpeedSet': {
        commands.push({ code: 'fan_speed_percent', value: Number(p.value) });
        break;
      }

      case 'setPosition': {
        commands.push({ code: 'percent_control', value: Number(p.value) });
        break;
      }

      case 'setTemperature': {
        commands.push({ code: 'temp_set', value: Number(p.value) });
        break;
      }

      case 'setMode': {
        commands.push({ code: 'mode', value: String(p.value) });
        break;
      }

      case 'startStop': {
        // Stop command for covers
        commands.push({ code: 'control', value: 'stop' });
        break;
      }

      case 'triggerScene': {
        // Scene trigger - handled separately
        // No commands to send, scene is triggered via different endpoint
        break;
      }

      default:
        this.log?.warn(`[TuyaWebApi] Unknown method: ${method}`);
    }

    return commands;
  }

  /**
   * Get the correct switch code for a device
   */
  private getSwitchCode(deviceId: string): string {
    const device = this.deviceCache.get(deviceId);
    const devType = device?.dev_type || device?.category || '';
    
    // Light devices typically use switch_led
    if (['light', 'dj', 'dd', 'fwd', 'dc', 'xdd', 'fsd'].includes(devType)) {
      return 'switch_led';
    }
    
    // Check cached state for known switch codes
    if (device?.data?.state !== undefined) {
      // Already has state, use the default
      return 'switch_1';
    }
    
    return 'switch_1';
  }

  /**
   * Enforce rate limiting between API calls
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    
    if (elapsed < this.minRequestInterval) {
      const delay = this.minRequestInterval - elapsed;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Update the device cache with new device data
   */
  public updateDeviceCache(device: TuyaDevice): void {
    this.deviceCache.set(device.id, device);
  }

  /**
   * Get a device from cache
   */
  public getCachedDevice(deviceId: string): TuyaDevice | undefined {
    return this.deviceCache.get(deviceId);
  }

  /**
   * Clear the device cache
   */
  public clearCache(): void {
    this.deviceCache.clear();
  }
}
