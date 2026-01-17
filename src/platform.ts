import type { 
  API, 
  Characteristic, 
  DynamicPlatformPlugin, 
  Logger, 
  PlatformAccessory, 
  PlatformConfig, 
  Service,
} from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { 
  TuyaOpenAPI, 
  TuyaMobileAPI,
  TuyaLinkingAuth, 
  TuyaDeviceAPI, 
  TuyaWebApi,
  TuyaDevice,
  TuyaTokens,
  TuyaRegion,
  convertNewDeviceToOld,
} from './api';
import {
  BaseAccessory,
  LightAccessory,
  SwitchAccessory,
  OutletAccessory,
  FanAccessory,
  CoverAccessory,
  ClimateAccessory,
  SceneAccessory,
  DimmerAccessory,
  GarageDoorAccessory,
  WindowAccessory,
  TemperatureSensorAccessory,
} from './accessories';

/**
 * HomebridgeAccessory type used by the old accessory system
 */
export interface HomebridgeAccessory extends PlatformAccessory {
  controller?: BaseAccessory;
  context: {
    deviceId?: string;
    cache?: unknown;
  };
  // Internal HAP accessor for display name updates
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _associatedHAPAccessory: any;
}

export interface TuyaWebConfig extends PlatformConfig {
  region?: TuyaRegion;
  tokens?: TuyaTokens;
  pollingInterval?: number;
  hiddenAccessories?: string[];
  debug?: boolean;
  // Device-specific configuration overrides
  devices?: Array<{
    id?: string;
    name?: string;
    device_type?: string;
    [key: string]: unknown;
  }>;
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
  public readonly accessories: Map<string, HomebridgeAccessory> = new Map();
  public readonly discoveredCacheUUIDs: string[] = [];

  // Tuya API instances
  private openApi!: TuyaOpenAPI;
  private mobileApi!: TuyaMobileAPI;
  private deviceApi!: TuyaDeviceAPI;
  private linkingAuth!: TuyaLinkingAuth;
  
  // Old-style API wrapper for accessories
  public tuyaWebApi!: TuyaWebApi;

  // Platform accessory constructor
  public readonly platformAccessory: typeof PlatformAccessory;

  // Polling timer
  private pollingTimer?: NodeJS.Timeout;

  constructor(
    public readonly log: Logger,
    public readonly config: TuyaWebConfig,
    public readonly hbApi: API,
  ) {
    this.Service = hbApi.hap.Service;
    this.Characteristic = hbApi.hap.Characteristic;
    this.platformAccessory = hbApi.platformAccessory as unknown as typeof PlatformAccessory;

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
    this.openApi = new TuyaOpenAPI(region, this.log);
    const endpoints: Record<TuyaRegion, string> = {
      US: 'https://openapi.tuyaus.com',
      EU: 'https://openapi.tuyaeu.com',
      CN: 'https://openapi.tuyacn.com',
      IN: 'https://openapi.tuyain.com',
    };
    const baseUrl = endpoints[region] || endpoints.US;
    
    this.mobileApi = new TuyaMobileAPI(baseUrl, this.log);
    this.deviceApi = new TuyaDeviceAPI(this.openApi, this.mobileApi, this.log);
    this.linkingAuth = new TuyaLinkingAuth(region, this.log);
    
    // Create old-style API wrapper for accessories
    this.tuyaWebApi = new TuyaWebApi(this.deviceApi, this.log);

    // Restore tokens if available
    if (this.config.tokens?.accessToken) {
      this.log.debug('Restoring saved tokens');
      this.openApi.setTokens(this.config.tokens);
      this.mobileApi.setTokens(this.config.tokens);
    }
  }

  /**
   * Get API instances for custom UI
   */
  public getApi(): TuyaOpenAPI {
    return this.openApi;
  }

  public getLinkingAuth(): TuyaLinkingAuth {
    return this.linkingAuth;
  }

  /**
   * Generate a UUID from a device ID
   */
  public generateUUID(deviceId: string): string {
    return this.hbApi.hap.uuid.generate(deviceId);
  }

  /**
   * Register a new platform accessory
   */
  public registerPlatformAccessory(accessory: HomebridgeAccessory): void {
    this.log.debug('Registering new accessory:', accessory.displayName);
    this.hbApi.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory as PlatformAccessory]);
    this.accessories.set(accessory.UUID, accessory);
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   */
  configureAccessory(accessory: PlatformAccessory): void {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.set(accessory.UUID, accessory as HomebridgeAccessory);
  }

  /**
   * Discover and register Tuya devices
   */
  async discoverDevices(): Promise<void> {
    // Check if we have valid tokens
    if (!this.openApi.hasValidTokens()) {
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
      
      // Get devices in old format via tuyaWebApi
      const devices = await this.tuyaWebApi.getAllDevices();
      
      this.log.info(`Found ${devices.length} device(s)`);

      for (const device of devices) {
        // Check if device is hidden
        if (this.isDeviceHidden(device)) {
          this.log.debug('Skipping hidden device:', device.name);
          continue;
        }

        // Apply device-specific config overrides
        const configOverride = this.getDeviceConfig(device.id, device.name);
        if (configOverride) {
          device.config = { ...device.config, ...configOverride };
          // Override device type if specified
          if (configOverride.device_type && typeof configOverride.device_type === 'string') {
            device.dev_type = configOverride.device_type;
          }
        }

        // Generate UUID from device ID
        const uuid = this.generateUUID(device.id);
        this.discoveredCacheUUIDs.push(uuid);

        // Check if accessory already exists
        const existingAccessory = this.accessories.get(uuid);

        try {
          // Create the appropriate accessory type
          this.createAccessory(device, existingAccessory);
        } catch (error) {
          this.log.error(`Failed to create accessory for ${device.name}:`, error);
        }
      }

      // Remove accessories that are no longer present
      for (const [uuid, accessory] of this.accessories) {
        if (!this.discoveredCacheUUIDs.includes(uuid)) {
          this.log.info('Removing accessory no longer present:', accessory.displayName);
          this.hbApi.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory as PlatformAccessory]);
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
   * Get device-specific configuration from config
   */
  private getDeviceConfig(deviceId: string, deviceName: string): Record<string, unknown> | undefined {
    if (!this.config.devices) {
      return undefined;
    }

    return this.config.devices.find(
      d => d.id === deviceId || d.name === deviceName,
    );
  }

  /**
   * Create the appropriate accessory type based on device type
   */
  private createAccessory(device: TuyaDevice, existingAccessory?: HomebridgeAccessory): void {
    const devType = device.dev_type || device.ha_type || 'switch';
    
    this.log.debug(`Creating accessory for ${device.name} (type: ${devType})`);

    // Map device type to accessory class
    switch (devType) {
      case 'light':
      case 'dj':
      case 'dd':
      case 'fwd':
      case 'dc':
      case 'xdd':
      case 'fsd':
        new LightAccessory(this, existingAccessory, device);
        break;

      case 'dimmer':
        new DimmerAccessory(this, existingAccessory, device);
        break;

      case 'outlet':
      case 'cz':
      case 'pc':
        new OutletAccessory(this, existingAccessory, device);
        break;

      case 'fan':
      case 'fs':
      case 'fskg':
        new FanAccessory(this, existingAccessory, device);
        break;

      case 'cover':
      case 'cl':
      case 'clkg':
        new CoverAccessory(this, existingAccessory, device);
        break;

      case 'garage':
      case 'ckmkzq':
        new GarageDoorAccessory(this, existingAccessory, device);
        break;

      case 'window':
        new WindowAccessory(this, existingAccessory, device);
        break;

      case 'climate':
      case 'kt':
      case 'wk':
      case 'rs':
        new ClimateAccessory(this, existingAccessory, device);
        break;

      case 'scene':
        new SceneAccessory(this, existingAccessory, device);
        break;

      case 'temperature_sensor':
      case 'wsdcg':
        new TemperatureSensorAccessory(this, existingAccessory, device);
        break;

      case 'switch':
      case 'kg':
      default:
        new SwitchAccessory(this, existingAccessory, device);
        break;
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
        const devices = await this.tuyaWebApi.getAllDevices();
        
        for (const device of devices) {
          const uuid = this.generateUUID(device.id);
          const accessory = this.accessories.get(uuid);
          
          if (accessory?.controller) {
            this.log.debug(`Updating status for ${device.name}`);
            accessory.controller.updateAccessory(device);
            this.hbApi.updatePlatformAccessories([accessory as PlatformAccessory]);
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
    this.openApi?.destroy();
    this.linkingAuth?.destroy();
  }
}
