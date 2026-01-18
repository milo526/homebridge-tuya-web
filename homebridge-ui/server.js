/**
 * Custom UI Server for Homebridge Config UI X
 * 
 * Provides endpoints for the QR code linking flow.
 * Uses embedded Tuya credentials - no user configuration needed.
 */

const { HomebridgePluginUiServer } = require('@homebridge/plugin-ui-utils');
const QRCode = require('qrcode');
const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Embedded credentials (same as Home Assistant)
const TUYA_CLIENT_ID = 'HA_3y9q4ak7g4ephrvke';
const TUYA_SCHEMA = 'haauthorize';

// Token storage file name (must match TokenStorage.ts)
const TOKEN_FILE_NAME = 'tuya-tokens.json';


class TuyaUiServer extends HomebridgePluginUiServer {
    constructor() {
        super();

        this.linkingState = null;

        // Register request handlers
        this.onRequest('/start-linking', this.startLinking.bind(this));
        this.onRequest('/check-status', this.checkStatus.bind(this));
        this.onRequest('/get-config', this.getConfig.bind(this));
        this.onRequest('/clear-tokens', this.clearTokens.bind(this));

        this.ready();
    }

    /**
       * Sign a Tuya API request (simplified for haauthorize schema)
       */
    signRequest(method, path, body) {
        const timestamp = Date.now().toString();
        const nonce = crypto.randomUUID();

        const bodyStr = body ? JSON.stringify(body) : '';
        const contentHash = crypto.createHash('sha256').update(bodyStr).digest('hex');
        const stringToSign = [method, contentHash, '', path].join('\n');

        // For haauthorize schema, use empty secret
        const signStr = TUYA_CLIENT_ID + timestamp + nonce + stringToSign;
        const sign = crypto.createHmac('sha256', '').update(signStr).digest('hex').toUpperCase();

        return {
            'client_id': TUYA_CLIENT_ID,
            't': timestamp,
            'sign': sign,
            'sign_method': 'HMAC-SHA256',
            'nonce': nonce,
            'Content-Type': 'application/json',
        };
    }

    /**
       * Start the linking process - generate QR code
       */
    async startLinking(payload) {
        try {
            const region = payload.region || 'US';
            const userCode = payload.userCode;

            if (!userCode) {
                throw new Error('User Code is required');
            }

            // Use the specific API gateway for HA/QR flow
            const baseUrl = 'https://apigw.iotbing.com';
            const path = '/v1.0/m/life/home-assistant/qrcode/tokens';

            // Construct URL with query params - no body, no headers needed for this specific endpoint
            const url = `${baseUrl}${path}?clientid=${TUYA_CLIENT_ID}&usercode=${userCode}&schema=${TUYA_SCHEMA}`;

            const response = await axios.post(url);

            if (!response.data.success || !response.data.result) {
                throw new Error(`Tuya API error: ${response.data.msg || 'Unknown error'}`);
            }

            const { qrcode, expire_time } = response.data.result;

            // Generate QR code data URL
            const qrData = `tuyaSmart--qrLogin?token=${qrcode}`;
            const qrImage = await QRCode.toDataURL(qrData, {
                width: 256,
                margin: 2,
                color: { dark: '#000000', light: '#ffffff' },
            });

            // Store state
            this.linkingState = {
                qrcode,
                userCode,
                region,
                expiresAt: Date.now() + expire_time * 1000,
            };

            return { success: true, qrImage, expiresIn: expire_time };
        } catch (error) {
            console.error('Start linking failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
       * Check the linking status
       */
    async checkStatus() {
        try {
            if (!this.linkingState) {
                return { success: false, error: 'No linking in progress' };
            }

            if (Date.now() > this.linkingState.expiresAt) {
                this.linkingState = null;
                return { success: true, status: 'expired' };
            }

            // Check status with simple GET request
            const baseUrl = 'https://apigw.iotbing.com';
            const path = `/v1.0/m/life/home-assistant/qrcode/tokens/${this.linkingState.qrcode}`;
            const url = `${baseUrl}${path}?clientid=${TUYA_CLIENT_ID}&usercode=${this.linkingState.userCode}`;

            const response = await axios.get(url);

            if (!response.data.success) {
                if (response.data.code === 1106) {
                    this.linkingState = null;
                    return { success: true, status: 'expired' };
                }
                // Sometimes it returns success:false but still gives useful info in msg?? 
                // But for this specific endpoint:
                throw new Error(`Tuya API error: ${response.data.msg}`);
            }

            const result = response.data.result;

            // Map result to status
            if (result && result.access_token) {
                const tokens = {
                    accessToken: result.access_token,
                    refreshToken: result.refresh_token,
                    expiresIn: result.expire_time,
                    expiresAt: Date.now() + result.expire_time * 1000,
                    uid: result.uid,
                };

                this.linkingState = null;
                return { success: true, status: 'authorized', tokens };
            }

            // If we are here, is it pending? 
            return { success: true, status: 'pending' };

        } catch (error) {
            console.error('Check status failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
       * Get current config
       */
    async getConfig() {
        try {
            const config = await this.getPluginConfig();
            return { success: true, config: config[0] || {} };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
       * Clear tokens from config and storage file
       * This allows re-linking without nuking the entire plugin
       */
    async clearTokens() {
        try {
            // Clear tokens from config
            const configs = await this.getPluginConfig();
            const config = configs[0] || {};
            
            delete config.tokens;
            
            await this.updatePluginConfig([config]);
            await this.savePluginConfig();

            // Also try to delete the token storage file
            try {
                const storagePath = this.homebridgeStoragePath;
                const tokenFilePath = path.join(storagePath, TOKEN_FILE_NAME);
                await fs.unlink(tokenFilePath);
                console.log('Deleted token storage file:', tokenFilePath);
            } catch (fileError) {
                // File might not exist, that's fine
                console.log('Token storage file not found or could not be deleted:', fileError.message);
            }

            return { success: true, message: 'Tokens cleared successfully' };
        } catch (error) {
            console.error('Clear tokens failed:', error);
            return { success: false, error: error.message };
        }
    }
}

(() => new TuyaUiServer())();
