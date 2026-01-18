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
import { TokenStorage } from './helpers/TokenStorage';
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

  // Token persistence
  private tokenStorage!: TokenStorage;

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
    this.hbApi.on('didFinishLaunching', async () => {
      this.log.debug('Homebridge finished launching');
      
      // Wait for tokens to be loaded from storage before discovering devices
      await this.loadAndRestoreTokens();
      
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

    // Initialize token storage for persistence across restarts
    this.tokenStorage = new TokenStorage(this.hbApi);

    // Set up token refresh callbacks to sync tokens between APIs and persist
    this.setupTokenRefreshCallbacks();
    
    // Note: Token loading happens in didFinishLaunching to ensure it completes
    // before device discovery starts
  }

  /**
   * Load tokens from storage or config
   * Storage takes priority if it has newer tokens (from runtime refresh)
   */
  private async loadAndRestoreTokens(): Promise<void> {
    try {
      // Try to load from persistent storage first (contains refreshed tokens)
      const storedTokens = await this.tokenStorage.loadTokens();
      const configTokens = this.config.tokens;

      let tokensToUse: TuyaTokens | null = null;

      if (storedTokens && configTokens) {
        // Use whichever tokens are newer (have later expiry)
        if (storedTokens.expiresAt > configTokens.expiresAt) {
          this.log.debug('Using tokens from storage (newer than config)');
          tokensToUse = storedTokens;
        } else {
          this.log.debug('Using tokens from config (newer than storage)');
          tokensToUse = configTokens;
        }
      } else if (storedTokens) {
        this.log.debug('Using tokens from storage');
        tokensToUse = storedTokens;
      } else if (configTokens?.accessToken) {
        this.log.debug('Using tokens from config');
        tokensToUse = configTokens;
      }

      if (tokensToUse) {
        this.openApi.setTokens(tokensToUse);
        this.mobileApi.setTokens(tokensToUse);
        this.log.info('Tokens restored, expires at:', new Date(tokensToUse.expiresAt).toLocaleString());
      }
    } catch (error) {
      this.log.error('Failed to load tokens:', error);
      // Fall back to config tokens
      if (this.config.tokens?.accessToken) {
        this.openApi.setTokens(this.config.tokens);
        this.mobileApi.setTokens(this.config.tokens);
      }
    }
  }

  /**
   * Set up token refresh callbacks and handlers to sync tokens between APIs
   * - OpenAPI has its own refresh mechanism; callback syncs to MobileAPI
   * - MobileAPI delegates refresh to OpenAPI via handler
   */
  private setupTokenRefreshCallbacks(): void {
    // When OpenAPI refreshes tokens, sync to MobileAPI and persist
    this.openApi.setTokenRefreshCallback((tokens: TuyaTokens) => {
      this.log.debug('OpenAPI tokens refreshed, syncing to MobileAPI...');
      this.mobileApi.setTokens(tokens);
      this.persistTokens(tokens);
    });

    // When MobileAPI needs to refresh, delegate to OpenAPI
    // This returns the refreshed tokens which MobileAPI will use
    this.mobileApi.setTokenRefreshHandler(async (): Promise<TuyaTokens> => {
      this.log.debug('MobileAPI requesting token refresh via OpenAPI...');
      const newTokens = await this.openApi.refreshAccessToken();
      // Note: The OpenAPI callback above will sync tokens to MobileAPI,
      // but we also return them here for the handler to use immediately
      return newTokens;
    });
  }

  /**
   * Persist tokens to storage
   * Saves to a file in Homebridge's storage directory so tokens survive restarts.
   */
  private persistTokens(tokens: TuyaTokens): void {
    this.log.info('Persisting refreshed tokens to storage');
    
    // Update in-memory config
    this.config.tokens = tokens;
    
    // Save to persistent storage file
    this.tokenStorage.saveTokens(tokens)
      .then(() => {
        this.log.debug('Tokens saved to persistent storage');
      })
      .catch((error) => {
        this.log.error('Failed to persist tokens:', error);
      });
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
