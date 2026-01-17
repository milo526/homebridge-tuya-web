import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import type { TuyaWebPlatform } from './platform';
import { TuyaDeviceAPI, TuyaDevice, TuyaDeviceStatus } from './api';

/**
 * TuyaAccessory
 * An accessory handler for a single Tuya device.
 * Handles communication between HomeKit and the Tuya device.
 */
export class TuyaAccessory {
  private service!: Service;
  private device: TuyaDevice;

  constructor(
    private readonly platform: TuyaWebPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly deviceApi: TuyaDeviceAPI,
  ) {
    this.device = accessory.context.device as TuyaDevice;

    // Set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Tuya')
      .setCharacteristic(this.platform.Characteristic.Model, this.device.product_name || this.device.category)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.device.id);

    // Create the appropriate service based on device category
    this.setupService();
  }

  /**
   * Set up the HomeKit service based on device category
   */
  private setupService(): void {
    const category = this.device.category;
    const accessoryType = this.deviceApi.getAccessoryType(category);

    this.platform.log.debug(`Setting up ${this.device.name} as ${accessoryType || 'switch'} (category: ${category})`);

    switch (accessoryType) {
    case 'light':
      this.setupLightService();
      break;
    case 'outlet':
      this.setupOutletService();
      break;
    case 'fan':
      this.setupFanService();
      break;
    case 'motion_sensor':
      this.setupMotionSensorService();
      break;
    case 'contact_sensor':
      this.setupContactSensorService();
      break;
    case 'temp_sensor':
      this.setupTemperatureSensorService();
      break;
    case 'switch':
    default:
      this.setupSwitchService();
      break;
    }
  }

  /**
   * Set up a switch service
   */
  private setupSwitchService(): void {
    this.service = this.accessory.getService(this.platform.Service.Switch) 
      || this.accessory.addService(this.platform.Service.Switch);

    this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.name);

    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getOn.bind(this))
      .onSet(this.setOn.bind(this));
  }

  /**
   * Set up an outlet service
   */
  private setupOutletService(): void {
    this.service = this.accessory.getService(this.platform.Service.Outlet) 
      || this.accessory.addService(this.platform.Service.Outlet);

    this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.name);

    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getOn.bind(this))
      .onSet(this.setOn.bind(this));
  }

  /**
   * Set up a light service
   */
  private setupLightService(): void {
    this.service = this.accessory.getService(this.platform.Service.Lightbulb) 
      || this.accessory.addService(this.platform.Service.Lightbulb);

    this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.name);

    // On/Off
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getOn.bind(this))
      .onSet(this.setOn.bind(this));

    // Brightness (if supported)
    if (this.hasStatus('bright_value_v2') || this.hasStatus('bright_value')) {
      this.service.getCharacteristic(this.platform.Characteristic.Brightness)
        .onGet(this.getBrightness.bind(this))
        .onSet(this.setBrightness.bind(this));
    }

    // Color Temperature (if supported)
    if (this.hasStatus('temp_value_v2') || this.hasStatus('temp_value')) {
      this.service.getCharacteristic(this.platform.Characteristic.ColorTemperature)
        .onGet(this.getColorTemperature.bind(this))
        .onSet(this.setColorTemperature.bind(this));
    }

    // Hue and Saturation (if RGB supported)
    if (this.hasStatus('colour_data_v2') || this.hasStatus('colour_data')) {
      this.service.getCharacteristic(this.platform.Characteristic.Hue)
        .onGet(this.getHue.bind(this))
        .onSet(this.setHue.bind(this));

      this.service.getCharacteristic(this.platform.Characteristic.Saturation)
        .onGet(this.getSaturation.bind(this))
        .onSet(this.setSaturation.bind(this));
    }
  }

  /**
   * Set up a fan service
   */
  private setupFanService(): void {
    this.service = this.accessory.getService(this.platform.Service.Fanv2) 
      || this.accessory.addService(this.platform.Service.Fanv2);

    this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.name);

    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .onGet(this.getActive.bind(this))
      .onSet(this.setActive.bind(this));

    // Speed (if supported)
    if (this.hasStatus('fan_speed_percent') || this.hasStatus('speed')) {
      this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
        .onGet(this.getFanSpeed.bind(this))
        .onSet(this.setFanSpeed.bind(this));
    }
  }

  /**
   * Set up motion sensor service
   */
  private setupMotionSensorService(): void {
    this.service = this.accessory.getService(this.platform.Service.MotionSensor) 
      || this.accessory.addService(this.platform.Service.MotionSensor);

    this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.name);

    this.service.getCharacteristic(this.platform.Characteristic.MotionDetected)
      .onGet(this.getMotionDetected.bind(this));
  }

  /**
   * Set up contact sensor service
   */
  private setupContactSensorService(): void {
    this.service = this.accessory.getService(this.platform.Service.ContactSensor) 
      || this.accessory.addService(this.platform.Service.ContactSensor);

    this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.name);

    this.service.getCharacteristic(this.platform.Characteristic.ContactSensorState)
      .onGet(this.getContactState.bind(this));
  }

  /**
   * Set up temperature sensor service
   */
  private setupTemperatureSensorService(): void {
    this.service = this.accessory.getService(this.platform.Service.TemperatureSensor) 
      || this.accessory.addService(this.platform.Service.TemperatureSensor);

    this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.name);

    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getTemperature.bind(this));
  }

  // ============ Characteristic Handlers ============

  /**
   * Get device status value by code
   */
  private getStatusValue(code: string): boolean | number | string | undefined {
    const status = this.device.status?.find((s: TuyaDeviceStatus) => s.code === code);
    return status?.value;
  }

  /**
   * Check if device has a specific status code
   */
  private hasStatus(code: string): boolean {
    return this.device.status?.some((s: TuyaDeviceStatus) => s.code === code) ?? false;
  }

  /**
   * Get On/Off state
   */
  async getOn(): Promise<CharacteristicValue> {
    // Try various power status codes
    const codes = ['switch_led', 'switch_1', 'switch', 'power'];
    for (const code of codes) {
      const value = this.getStatusValue(code);
      if (typeof value === 'boolean') {
        return value;
      }
    }
    return this.device.online;
  }

  /**
   * Set On/Off state
   */
  async setOn(value: CharacteristicValue): Promise<void> {
    this.platform.log.debug(`Setting ${this.device.name} power to ${value}`);
    
    const codes = ['switch_led', 'switch_1', 'switch', 'power'];
    for (const code of codes) {
      if (this.hasStatus(code)) {
        await this.deviceApi.sendCommands(this.device.id, [{ code, value: value as boolean }]);
        return;
      }
    }
    
    // Default to switch_led
    await this.deviceApi.sendCommands(this.device.id, [{ code: 'switch_led', value: value as boolean }]);
  }

  /**
   * Get brightness (0-100)
   */
  async getBrightness(): Promise<CharacteristicValue> {
    // Check V2 (0-1000)
    const v2 = this.getStatusValue('bright_value_v2');
    if (typeof v2 === 'number') {
      return Math.round(v2 / 10);
    }
    
    // Check V1 (0-255)
    const v1 = this.getStatusValue('bright_value');
    if (typeof v1 === 'number') {
      return Math.round((v1 / 255) * 100);
    }

    return 100;
  }

  /**
   * Set brightness (0-100)
   */
  async setBrightness(value: CharacteristicValue): Promise<void> {
    this.platform.log.debug(`Setting ${this.device.name} brightness to ${value}`);
    await this.deviceApi.setBrightness(this.device.id, value as number);
  }

  /**
   * Get color temperature (in mireds, 140-500)
   */
  async getColorTemperature(): Promise<CharacteristicValue> {
    // Check V2 (0-1000)
    const v2 = this.getStatusValue('temp_value_v2');
    if (typeof v2 === 'number') {
      const kelvin = 2700 + (v2 / 1000) * (6500 - 2700);
      return Math.round(1000000 / kelvin);
    }

    // Check V1 (0-255)
    const v1 = this.getStatusValue('temp_value');
    if (typeof v1 === 'number') {
      const kelvin = 2700 + (v1 / 255) * (6500 - 2700);
      return Math.round(1000000 / kelvin);
    }

    return 300; // default ~3333K
  }

  /**
   * Set color temperature (in mireds)
   */
  async setColorTemperature(value: CharacteristicValue): Promise<void> {
    this.platform.log.debug(`Setting ${this.device.name} color temp to ${value} mireds`);
    // Convert mireds to Kelvin
    const kelvin = Math.round(1000000 / (value as number));
    await this.deviceApi.setColorTemperature(this.device.id, kelvin);
  }

  private cachedHue = 0;
  private cachedSaturation = 0;

  /**
   * Get hue (0-360)
   */
  async getHue(): Promise<CharacteristicValue> {
    const colorData = this.getColorData();
    return colorData?.h ?? 0;
  }

  /**
   * Set hue
   */
  async setHue(value: CharacteristicValue): Promise<void> {
    this.cachedHue = value as number;
    await this.setColor();
  }

  /**
   * Get saturation (0-100)
   */
  async getSaturation(): Promise<CharacteristicValue> {
    const colorData = this.getColorData();
    if (!colorData) {
      return 0;
    }
    
    // If V2, scale is 0-1000. If V1, scale is 0-255.
    if (this.hasStatus('colour_data_v2')) {
      return Math.round(colorData.s / 10);
    } else {
      // V1 scale 0-255
      return Math.round((colorData.s / 255) * 100);
    }
  }

  /**
   * Set saturation
   */
  async setSaturation(value: CharacteristicValue): Promise<void> {
    this.cachedSaturation = value as number;
    await this.setColor();
  }

  /**
   * Parse Tuya color data
   */
  private getColorData(): { h: number; s: number; v: number } | undefined {
    const value = this.getStatusValue('colour_data_v2') ?? this.getStatusValue('colour_data');
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  /**
   * Set color using cached hue/saturation values
   */
  private async setColor(): Promise<void> {
    await this.deviceApi.setColor(
      this.device.id, 
      this.cachedHue, 
      this.cachedSaturation, 
      100,
    );
  }

  /**
   * Get fan active state
   */
  async getActive(): Promise<CharacteristicValue> {
    const isOn = await this.getOn();
    return isOn ? 1 : 0;
  }

  /**
   * Set fan active state
   */
  async setActive(value: CharacteristicValue): Promise<void> {
    await this.setOn(value === 1);
  }

  /**
   * Get fan speed (0-100)
   */
  async getFanSpeed(): Promise<CharacteristicValue> {
    const value = this.getStatusValue('fan_speed_percent') ?? this.getStatusValue('speed');
    return (value as number) ?? 50;
  }

  /**
   * Set fan speed (0-100)
   */
  async setFanSpeed(value: CharacteristicValue): Promise<void> {
    const code = this.hasStatus('fan_speed_percent') ? 'fan_speed_percent' : 'speed';
    await this.deviceApi.sendCommands(this.device.id, [{ code, value: value as number }]);
  }

  /**
   * Get motion detected state
   */
  async getMotionDetected(): Promise<CharacteristicValue> {
    const value = this.getStatusValue('pir');
    return typeof value === 'string' ? value === 'pir' : !!value;
  }

  /**
   * Get contact sensor state
   */
  async getContactState(): Promise<CharacteristicValue> {
    const value = this.getStatusValue('doorcontact_state');
    return value ? 1 : 0;
  }

  /**
   * Get temperature (in Celsius)
   */
  async getTemperature(): Promise<CharacteristicValue> {
    const value = this.getStatusValue('va_temperature') ?? this.getStatusValue('temp_current');
    if (typeof value === 'number') {
      return value > 100 ? value / 10 : value;
    }
    return 20;
  }
}
