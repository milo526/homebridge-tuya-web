import { TuyaDevice } from "../api/response";

export class DeviceList {
  private idNameMap: Record<string, string> = {};

  constructor(devices: TuyaDevice[]) {
    devices.forEach((device) => {
      this.idNameMap[device.id] = device.name;
    });
  }

  /**
   * Returns the device ID belonging to the supplied identifier
   * @param identifier
   */
  public find(identifier: string): string | undefined {
    if (Object.keys(this.idNameMap).includes(identifier)) {
      return identifier;
    }

    if (Object.values(this.idNameMap).includes(identifier)) {
      return Object.keys(this.idNameMap).find(
        (key) => this.idNameMap[key] === identifier,
      );
    }

    return undefined;
  }

  /**
   * Returns all device ids in this list
   */
  public get all(): string[] {
    return Object.keys(this.idNameMap);
  }
}
