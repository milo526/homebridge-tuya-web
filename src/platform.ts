import type { 
  API, 
  Characteristic, 
  DynamicPlatformPlugin, 
  Logger, 
  PlatformAccessory, 
  PlatformConfig, 
  Service,
} from 'homebridge';

import { TuyaAccessory } from './platformAccessory';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { 
  TuyaOpenAPI, 
  TuyaMobileAPI,
  TuyaLinkingAuth, 
  TuyaDeviceAPI, 
  TuyaDevice, 
  TuyaTokens,
  TuyaRegion,
} from './api';

export interface TuyaWebConfig extends PlatformConfig {
  region?: TuyaRegion;
  tokens?: TuyaTokens;
  pollingInterval?: number;
  hiddenAccessories?: string[];
  debug?: boolean;
}

/**
 * TuyaWebPlatform
 * Main platform class for the Homebridge Tuya plugin.
 * Handles device discovery and accessory registration.
 */
export class TuyaWebPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  // Track restored cached accessories
  public readonly accessories: Map<string, PlatformAccessory> = new Map();
  public readonly discoveredCacheUUIDs: string[] = [];

  // Tuya API instances
  private api!: TuyaOpenAPI;
  private mobileApi!: TuyaMobileAPI;
  private deviceApi!: TuyaDeviceAPI;
  private linkingAuth!: TuyaLinkingAuth;

  // Polling timer
  private pollingTimer?: NodeJS.Timeout;

  constructor(
    public readonly log: Logger,
    public readonly config: TuyaWebConfig,
    public readonly hbApi: API,
  ) {
    this.Service = hbApi.hap.Service;
    this.Characteristic = hbApi.hap.Characteristic;

    this.log.debug('Initializing Tuya platform...');

    // Initialize Tuya API with config
    this.initializeApi();

    // When Homebridge has restored cached accessories
    this.hbApi.on('didFinishLaunching', () => {
      this.log.debug('Homebridge finished launching');
      this.discoverDevices();
    });

    // Clean up on shutdown
    this.hbApi.on('shutdown', () => {
      this.destroy();
    });
  }

  /**
   * Initialize the Tuya API client
   */
  private initializeApi(): void {
    const region = this.config.region || 'US';

    // Create API instances - no credentials needed!
    this.api = new TuyaOpenAPI(region, this.log);
    const endpoints: Record<TuyaRegion, string> = {
      US: 'https://openapi.tuyaus.com',
      EU: 'https://openapi.tuyaeu.com',
      CN: 'https://openapi.tuyacn.com',
      IN: 'https://openapi.tuyain.com',
    };
    const baseUrl = endpoints[region] || endpoints.US;
    
    this.mobileApi = new TuyaMobileAPI(baseUrl, this.log);
    this.deviceApi = new TuyaDeviceAPI(this.api, this.mobileApi, this.log);
    this.linkingAuth = new TuyaLinkingAuth(region, this.log);

    // Restore tokens if available
    if (this.config.tokens?.accessToken) {
      this.log.debug('Restoring saved tokens');
      this.api.setTokens(this.config.tokens);
      this.mobileApi.setTokens(this.config.tokens);
    }
  }

  /**
   * Get API instances for custom UI
   */
  public getApi(): TuyaOpenAPI {
    return this.api;
  }

  public getLinkingAuth(): TuyaLinkingAuth {
    return this.linkingAuth;
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   */
  configureAccessory(accessory: PlatformAccessory): void {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.set(accessory.UUID, accessory);
  }

  /**
   * Discover and register Tuya devices
   */
  async discoverDevices(): Promise<void> {
    // Check if we have valid tokens
    if (!this.api.hasValidTokens()) {
      this.log.warn('╔════════════════════════════════════════════════════════════════╗');
      this.log.warn('║                   TUYA ACCOUNT NOT LINKED                      ║');
      this.log.warn('╠════════════════════════════════════════════════════════════════╣');
      this.log.warn('║  Please link your Tuya account using the Homebridge Config UI. ║');
      this.log.warn('║  1. Open Homebridge Config UI                                  ║');
      this.log.warn('║  2. Go to Plugins → Tuya Web → Settings                        ║');
      this.log.warn('║  3. Click "Link Tuya Account"                                  ║');
      this.log.warn('║  4. Scan the QR code with your Tuya/Smart Life app             ║');
      this.log.warn('╚════════════════════════════════════════════════════════════════╝');
      return;
    }

    try {
      this.log.info('Discovering Tuya devices...');
      const devices = await this.deviceApi.getDeviceList();
      
      this.log.info(`Found ${devices.length} device(s)`);

      for (const device of devices) {
        // Check if device is hidden
        if (this.isDeviceHidden(device)) {
          this.log.debug('Skipping hidden device:', device.name);
          continue;
        }

        // Generate UUID from device ID
        const uuid = this.hbApi.hap.uuid.generate(device.id);
        this.discoveredCacheUUIDs.push(uuid);

        // Check if accessory already exists
        const existingAccessory = this.accessories.get(uuid);

        if (existingAccessory) {
          // Update existing accessory
          this.log.info('Restoring existing accessory:', device.name);
          existingAccessory.context.device = device;
          new TuyaAccessory(this, existingAccessory, this.deviceApi);
        } else {
          // Create new accessory
          this.log.info('Adding new accessory:', device.name);
          const accessory = new this.hbApi.platformAccessory(device.name, uuid);
          accessory.context.device = device;
          new TuyaAccessory(this, accessory, this.deviceApi);
          this.hbApi.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.accessories.set(uuid, accessory);
        }
      }

      // Remove accessories that are no longer present
      for (const [uuid, accessory] of this.accessories) {
        if (!this.discoveredCacheUUIDs.includes(uuid)) {
          this.log.info('Removing accessory no longer present:', accessory.displayName);
          this.hbApi.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.accessories.delete(uuid);
        }
      }

      // Start polling for status updates
      this.startPolling();

    } catch (error) {
      this.log.error('Failed to discover devices:', error);
    }
  }

  /**
   * Check if a device should be hidden
   */
  private isDeviceHidden(device: TuyaDevice): boolean {
    if (!this.config.hiddenAccessories) {
      return false;
    }
    return this.config.hiddenAccessories.some(
      hidden => hidden === device.id || hidden === device.name,
    );
  }

  /**
   * Start polling for device status updates
   */
  private startPolling(): void {
    const interval = (this.config.pollingInterval || 60) * 1000;

    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }

    this.log.debug(`Starting polling every ${interval / 1000} seconds`);

    this.pollingTimer = setInterval(async () => {
      try {
        const devices = await this.deviceApi.getDeviceList();
        
        for (const device of devices) {
          const uuid = this.hbApi.hap.uuid.generate(device.id);
          const accessory = this.accessories.get(uuid);
          
          if (accessory) {
            accessory.context.device = device;
            this.hbApi.updatePlatformAccessories([accessory]);
          }
        }
      } catch (error) {
        this.log.error('Polling failed:', error);
      }
    }, interval);
  }

  /**
   * Clean up resources
   */
  private destroy(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }
    this.api?.destroy();
    this.linkingAuth?.destroy();
  }
}
