import {
  API,
  Characteristic,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  Service,
} from "homebridge";
import { PLATFORM_NAME, PLUGIN_NAME, TUYA_DISCOVERY_TIMEOUT } from "./settings";
import {
  BaseAccessory,
  ClimateAccessory,
  CoverAccessory,
  DimmerAccessory,
  FanAccessory,
  LightAccessory,
  OutletAccessory,
  SceneAccessory,
  SwitchAccessory,
} from "./accessories";
import { TuyaDeviceDefaults, TuyaWebConfig } from "./config";
import { AuthenticationError } from "./errors";
import { DeviceList } from "./helpers/DeviceList";
import { TuyaDevice, TuyaDeviceType, TuyaDeviceTypes } from "./api/response";
import { TuyaWebApi } from "./api/service";
import { TuyaPlatforms } from "./api/platform";
import { GarageDoorAccessory } from "./accessories/GarageDoorAccessory";
import { TemperatureSensorAccessory } from "./accessories/TemperatureSensorAccessory";
import { Cache } from "./helpers/cache";
import { WindowAccessory } from "./accessories/WindowAccessory";

export type HomebridgeAccessory = PlatformAccessory<
  Partial<{
    cache: Cache;
    deviceId: string;
  }>
> & {
  controller?: BaseAccessory;
};

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class TuyaWebPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic =
    this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories = new Map<string, HomebridgeAccessory>();

  // Cloud polling interval in seconds
  private readonly pollingInterval?: number;

  public readonly tuyaWebApi!: TuyaWebApi;

  private failedToInitAccessories = new Map<TuyaDeviceType, string[]>();

  constructor(
    public readonly log: Logger,
    public readonly config: TuyaWebConfig,
    public readonly api: API,
  ) {
    this.log.debug("Finished initializing platform:", this.config.name);

    if (!config || !config.options) {
      this.log.info(
        "No options found in configuration file, disabling plugin.",
      );
      return;
    }
    const options = config.options;

    if (
      options.username === undefined ||
      options.password === undefined ||
      options.countryCode === undefined
    ) {
      this.log.error("Missing required config parameter.");
      return;
    }

    if (
      options.platform !== undefined &&
      !TuyaPlatforms.includes(options.platform)
    ) {
      this.log.error(
        "Invalid platform provided, received %s but must be one of %s",
        options.platform,
        TuyaPlatforms,
      );
    }

    // Set cloud polling interval
    this.pollingInterval = config.options.pollingInterval;

    // Create Tuya Web API instance
    this.tuyaWebApi = new TuyaWebApi(
      options.username,
      options.password,
      options.countryCode,
      options.platform,
      this.log,
    );

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on("didFinishLaunching", () => {
      void this.postLaunchSetup.bind(this)();
    });
  }

  private async postLaunchSetup(): Promise<void> {
    try {
      await this.tuyaWebApi.getOrRefreshToken();
      // run the method to discover / register your devices as accessories
      await this.discoverDevices();

      if (this.pollingInterval) {
        //Tuya will probably still complain if we fetch a new request on the exact second.
        const pollingInterval = Math.max(
          this.pollingInterval,
          TUYA_DISCOVERY_TIMEOUT + 5,
        );
        this.log?.info(
          "Enable cloud polling with interval %ss",
          pollingInterval,
        );
        // Set interval for refreshing device states
        setInterval(() => {
          this.refreshDeviceStates().catch((e: unknown) => {
            if (e instanceof Error) {
              this.log.error(e.message);
              if (e.stack) {
                this.log.debug(e.stack);
              }
            }
          });
        }, pollingInterval * 1000);
      }
    } catch (e) {
      if (e instanceof AuthenticationError) {
        this.log.error("Authentication error: %s", e.message);
        return;
      }

      if (e instanceof Error) {
        this.log.error(e.message);
        if (e.stack) {
          this.log.debug(e.stack);
        }
        return;
      }

      this.log.error("Unknown error: %s", e);
    }
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to set up event handlers for characteristics and update respective values.
   */
  public configureAccessory(accessory: PlatformAccessory): void {
    this.log.info("Loading accessory from cache:", accessory.displayName);

    // add the restored accessory to the accessories cache, so we can track if it has already been registered
    this.accessories.set(accessory.UUID, accessory);
  }

  public removeAccessory(accessory: PlatformAccessory): void {
    this.log.info("Removing accessory:", accessory.displayName);
    this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
      accessory,
    ]);

    this.accessories.delete(accessory.UUID);
  }

  // Called from device classes
  public registerPlatformAccessory(accessory: PlatformAccessory): void {
    this.log.debug("Register Platform Accessory (%s)", accessory.displayName);
    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
      accessory,
    ]);
    this.accessories.set(accessory.UUID, accessory);
  }

  private async refreshDeviceStates(devices?: TuyaDevice[]): Promise<void> {
    devices =
      devices ??
      this.filterDeviceList(await this.tuyaWebApi.getAllDeviceStates());
    if (!devices) {
      return;
    }

    // Refresh device states
    for (const device of devices) {
      const uuid = this.api.hap.uuid.generate(device.id);
      const homebridgeAccessory = this.accessories.get(uuid);
      if (homebridgeAccessory) {
        homebridgeAccessory.controller?.updateAccessory(device);
      } else if (
        !this.failedToInitAccessories.get(device.dev_type)?.includes(uuid)
      ) {
        this.log.error(
          "Could not find Homebridge device with UUID (%s) for Tuya device (%s)",
          uuid,
          device.name,
        );
      }
    }
  }

  private addAccessory(device: TuyaDevice): void {
    const deviceType: TuyaDeviceType = device.dev_type ?? "switch";
    const uuid = this.api.hap.uuid.generate(device.id);
    const homebridgeAccessory = this.accessories.get(uuid);

    // Construct new accessory
    switch (deviceType) {
      case "cover":
        new CoverAccessory(this, homebridgeAccessory, device);
        break;
      case "climate":
        new ClimateAccessory(this, homebridgeAccessory, device);
        break;
      case "dimmer":
        new DimmerAccessory(this, homebridgeAccessory, device);
        break;
      case "fan":
        new FanAccessory(this, homebridgeAccessory, device);
        break;
      case "garage":
        new GarageDoorAccessory(this, homebridgeAccessory, device);
        break;
      case "light":
        new LightAccessory(this, homebridgeAccessory, device);
        break;
      case "outlet":
        new OutletAccessory(this, homebridgeAccessory, device);
        break;
      case "scene":
        new SceneAccessory(this, homebridgeAccessory, device);
        break;
      case "switch":
        new SwitchAccessory(this, homebridgeAccessory, device);
        break;
      case "temperature_sensor":
        new TemperatureSensorAccessory(this, homebridgeAccessory, device);
        break;
      case "window":
        new WindowAccessory(this, homebridgeAccessory, device);
        break;

      default:
        if (!this.failedToInitAccessories.get(deviceType)) {
          this.log.warn(
            "Could not init class for device type [%s]",
            deviceType,
          );
          this.failedToInitAccessories.set(deviceType, []);
        }
        this.failedToInitAccessories.set(deviceType, [
          uuid,
          ...this.failedToInitAccessories.get(deviceType)!,
        ]);
        break;
    }
  }

  private filterDeviceList(devices: TuyaDevice[] | undefined): TuyaDevice[] {
    if (!devices) {
      return [];
    }
    const allowedSceneIds = this.getAllowedSceneIds(devices);
    const hiddenAccessoryIds = this.getHiddenAccessoryIds(devices);
    return devices
      .filter((d) => d.dev_type !== "scene" || allowedSceneIds.includes(d.id))
      .filter((d) => !hiddenAccessoryIds.includes(d.id));
  }

  async discoverDevices(): Promise<void> {
    let devices = (await this.tuyaWebApi.discoverDevices()) ?? [];

    // Is device type overruled in config defaults?
    devices = this.applyConfigOverwrites(devices);
    devices.forEach((device) => {
      if (
        device.config?.old_dev_type &&
        device.config.old_dev_type.toLowerCase() !==
          device.dev_type.toLowerCase()
      ) {
        this.log.info(
          'Device type for "%s" is overruled in config from %s to: "%s"',
          device.name,
          device.config.old_dev_type,
          device.dev_type,
        );
      }
    });

    devices = this.filterDeviceList(devices);

    const cachedDeviceIds = [...this.accessories.keys()];
    const availableDeviceIds = devices.map((d) => this.generateUUID(d.id));

    for (const cachedDeviceId of cachedDeviceIds) {
      if (!availableDeviceIds.includes(cachedDeviceId)) {
        const device = this.accessories.get(cachedDeviceId)!;
        this.log.warn(
          "Device: %s - is no longer available and will be removed",
          device.displayName,
        );
        this.removeAccessory(device);
      }
    }

    // loop over the discovered devices and register each one if it has not already been registered
    for (const device of devices) {
      this.addAccessory(device);
    }

    await this.refreshDeviceStates(devices);
  }

  /**
   * Returns a validated set of defaults and their devices for which the type will need to be overridden.
   * @param devices
   * @private
   */
  private applyConfigOverwrites(devices: TuyaDevice[]): TuyaDevice[] {
    const configOverwriteData = this.config.defaults;

    if (!configOverwriteData) {
      return devices;
    }

    for (const configOverwrite of configOverwriteData as (Partial<TuyaDeviceDefaults> & {
      old_dev_type: TuyaDeviceType;
    })[]) {
      if (!configOverwrite.id) {
        this.log.warn(
          "Missing required `id` property on device configuration, received:\r\n%s",
          JSON.stringify(configOverwrite, undefined, 2),
        );
        continue;
      }

      if (!configOverwrite.device_type) {
        this.log.warn(
          "Missing required `device_type` property on device configuration, received:\r\n%s",
          JSON.stringify(configOverwrite, undefined, 2),
        );
        continue;
      }

      configOverwrite.device_type =
        configOverwrite.device_type.toLowerCase() as TuyaDeviceType;

      const device = devices.find(
        (device) =>
          device.id === configOverwrite.id ||
          device.name === configOverwrite.id,
      );
      if (!device) {
        this.log.warn(
          'Tried overwriting device config for: "%s" which is not a valid device-id or device-name.',
          configOverwrite.id,
        );
        continue;
      }

      if (!TuyaDeviceTypes.includes(configOverwrite.device_type)) {
        this.log.warn(
          'Tried overwriting device config for: "%s" - device-type "%s" is not a valid device-type.',
          device.name,
          configOverwrite.device_type,
        );
        continue;
      }

      configOverwrite.old_dev_type = device.dev_type;
      device.dev_type = configOverwrite.device_type;
      delete configOverwrite.device_type;
      delete configOverwrite.id;
      device.config = configOverwrite;
    }

    return devices;
  }

  /**
   * Returns a list of all allowed scene Ids.
   * @param devices
   * @private
   */
  private getAllowedSceneIds(devices: TuyaDevice[]): string[] {
    if (!this.config.scenes) {
      return [];
    }

    const sceneList = new DeviceList(
      devices.filter((d) => d.dev_type === "scene"),
    );

    if (
      !Array.isArray(this.config.scenesWhitelist) ||
      this.config.scenesWhitelist.length === 0
    ) {
      return sceneList.all;
    }

    const allowedSceneIds: string[] = [];

    for (const toAllowSceneIdentifier of this.config
      .scenesWhitelist as string[]) {
      const deviceIdentifier = sceneList.find(toAllowSceneIdentifier);
      if (deviceIdentifier) {
        allowedSceneIds.push(deviceIdentifier);
        continue;
      }

      this.log.warn(
        "Tried allowing non-existing scene %s",
        toAllowSceneIdentifier,
      );
    }

    return [...new Set(allowedSceneIds)];
  }

  /**
   * Returns a list of all devices that are not supposed to be exposed.
   * @param devices
   * @private
   */
  private getHiddenAccessoryIds(devices: TuyaDevice[]): string[] {
    if (!this.config.hiddenAccessories) {
      return [];
    }

    if (
      !Array.isArray(this.config.hiddenAccessories) ||
      this.config.hiddenAccessories.length === 0
    ) {
      return [];
    }

    const deviceList = new DeviceList(devices);

    const hiddenAccessoryIdentifiers: string[] = [];

    for (const toDisallowAccessoryIdentifier of this.config
      .hiddenAccessories as string[]) {
      const deviceIdentifier = deviceList.find(toDisallowAccessoryIdentifier);
      if (deviceIdentifier) {
        hiddenAccessoryIdentifiers.push(deviceIdentifier);
        continue;
      }

      this.log.warn(
        "Tried disallowing non-existing device %s",
        toDisallowAccessoryIdentifier,
      );
    }

    return [...new Set(hiddenAccessoryIdentifiers)];
  }

  public get platformAccessory(): typeof PlatformAccessory {
    return this.api.platformAccessory;
  }

  public get generateUUID(): (uuid: string) => string {
    return this.api.hap.uuid.generate;
  }
}
