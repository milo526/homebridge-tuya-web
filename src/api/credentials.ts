/**
 * Embedded Tuya Credentials
 * 
 * These are pre-registered credentials for the Homebridge Tuya integration.
 * They enable the linking code (QR scan) flow without requiring users to 
 * create a Tuya developer account.
 * 
 * The schema "haauthorize" is a special Tuya schema that works with the
 * Smart Life / Tuya Smart app for simplified authorization.
 */

// Pre-registered app credentials for the linking flow
// These work with the "haauthorize" schema for QR-based authentication
export const TUYA_CLIENT_ID = 'HA_3y9q4ak7g4ephrvke';
export const TUYA_SCHEMA = 'haauthorize';

// Note: The client secret is handled server-side by Tuya when using
// the "haauthorize" schema - we don't need to provide one.
// The QR linking flow exchanges user authorization for tokens directly.
