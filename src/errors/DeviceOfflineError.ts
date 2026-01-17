/**
 * DeviceOfflineError
 * 
 * Thrown when attempting to interact with a device that is offline.
 */
export class DeviceOfflineError extends Error {
  constructor(message = 'Device is offline') {
    super(message);
    this.name = 'DeviceOfflineError';
    Object.setPrototypeOf(this, DeviceOfflineError.prototype);
  }
}
