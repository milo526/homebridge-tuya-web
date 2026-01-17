/**
 * Tuya API Module
 * 
 * Re-exports all API classes for convenient importing.
 */

export { TUYA_CLIENT_ID, TUYA_SCHEMA } from './credentials';

export { TuyaLinkingAuth, TUYA_ENDPOINTS } from './TuyaLinkingAuth';
export type { TuyaRegion, TuyaTokens, QRCodeData, QRAuthStatus } from './TuyaLinkingAuth';

export { TuyaOpenAPI } from './TuyaOpenAPI';
export type { TuyaApiResponse } from './TuyaOpenAPI';

export { TuyaMobileAPI } from './TuyaMobileAPI';

export { TuyaDeviceAPI, DEVICE_CATEGORIES } from './TuyaDeviceAPI';
export type { 
  TuyaDevice as TuyaDeviceNew, 
  TuyaDeviceStatus, 
  TuyaDeviceCommand, 
  DeviceCategory, 
  AccessoryType,
} from './TuyaDeviceAPI';

// Old-style API and types for accessory compatibility
export { TuyaWebApi } from './TuyaWebApi';
export type {
  TuyaDevice,
  DeviceState,
  TuyaApiMethod,
  TuyaApiPayload,
  ExtendedBoolean,
} from './response';
export { statusArrayToDeviceState, convertNewDeviceToOld } from './response';
