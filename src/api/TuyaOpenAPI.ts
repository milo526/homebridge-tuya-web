/**
 * Tuya OpenAPI Client
 * 
 * Handles authenticated requests to Tuya Cloud API.
 * Uses tokens obtained from the linking flow.
 */

import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import crypto from 'crypto';
import type { Logger } from 'homebridge';
import { TUYA_CLIENT_ID } from './credentials';
import { TUYA_ENDPOINTS, TuyaRegion, TuyaTokens } from './TuyaLinkingAuth';

export interface TuyaApiResponse<T = unknown> {
  success: boolean;
  code?: number;
  msg?: string;
  result?: T;
  t: number;
  tid: string;
}

export type TokenRefreshCallback = (tokens: TuyaTokens) => void;

export class TuyaOpenAPI {
  private client: AxiosInstance;
  private tokens?: TuyaTokens;
  private tokenRefreshTimer?: NodeJS.Timeout;
  private onTokenRefresh?: TokenRefreshCallback;

  constructor(
    private readonly region: TuyaRegion = 'US',
    private readonly log?: Logger,
  ) {
    const baseURL = TUYA_ENDPOINTS[region];
    
    this.client = axios.create({
      baseURL,
      timeout: 10000,
    });

    // Add request interceptor for signing
    this.client.interceptors.request.use(
      (config) => this.signRequest(config),
      (error) => Promise.reject(error),
    );
  }

  /**
   * Set a callback to be called when tokens are refreshed
   * This allows the platform to persist the new tokens and sync with other APIs
   */
  public setTokenRefreshCallback(callback: TokenRefreshCallback): void {
    this.onTokenRefresh = callback;
  }

  /**
   * Set tokens from linking flow or stored config
   */
  public setTokens(tokens: TuyaTokens): void {
    this.tokens = tokens;
    this.scheduleTokenRefresh();
  }

  /**
   * Get current tokens (for saving to config)
   */
  public getTokens(): TuyaTokens | undefined {
    return this.tokens;
  }

  /**
   * Check if we have valid tokens
   */
  public hasValidTokens(): boolean {
    if (!this.tokens) {
      return false;
    }
    return this.tokens.expiresAt > Date.now() + 5 * 60 * 1000;
  }

  /**
   * Refresh the access token
   * For the haauthorize schema, we use the iotbing endpoint (same as QR auth)
   * without HMAC signing - just query parameters.
   */
  public async refreshAccessToken(): Promise<TuyaTokens> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    this.log?.info('Refreshing access token...');

    try {
      // Use the iotbing endpoint for haauthorize schema token refresh
      // This is the same endpoint pattern as the QR code auth flow
      const baseUrl = 'https://apigw.iotbing.com';
      const url = `${baseUrl}/v1.0/m/life/home-assistant/access/token/refresh?clientid=${TUYA_CLIENT_ID}&refresh_token=${this.tokens.refreshToken}`;
      
      this.log?.debug('Token refresh request to:', url);

      const response = await axios.get(url, { timeout: 15000 });
      const data = response.data;

      if (!data.success || !data.result) {
        // Log the full error for debugging
        this.log?.error('Token refresh failed:', JSON.stringify(data));
        
        // Check for specific error codes
        if (data.code === 1010 || data.code === 1004 || data.code === 1106) {
          // Token expired or invalid - need to re-authenticate
          throw new Error(`Token refresh failed (code ${data.code}): ${data.msg}. Please re-link your Tuya account.`);
        }
        throw new Error(`Failed to refresh token: ${data.msg || 'Unknown error'}`);
      }

      const result = data.result;
      this.tokens = {
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
        expiresIn: result.expire_time,
        expiresAt: Date.now() + result.expire_time * 1000,
        uid: result.uid || this.tokens.uid,
      };

      this.scheduleTokenRefresh();
      this.log?.info('Access token refreshed successfully, expires in', result.expire_time, 'seconds');

      // Notify callback so platform can persist tokens and sync with other APIs
      if (this.onTokenRefresh) {
        this.onTokenRefresh(this.tokens);
      }

      return this.tokens;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        const data = error.response.data;
        this.log?.error('Token refresh HTTP error:', error.response.status, JSON.stringify(data));
        
        // Check for 404 - endpoint might not exist, try alternate endpoint
        if (error.response.status === 404) {
          return this.refreshAccessTokenAlternate();
        }
      }
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log?.error('Token refresh error:', errorMsg);
      throw error;
    }
  }

  /**
   * Alternate token refresh using standard OpenAPI endpoint
   * Fallback if iotbing endpoint doesn't work
   */
  private async refreshAccessTokenAlternate(): Promise<TuyaTokens> {
    this.log?.info('Trying alternate token refresh endpoint...');

    // Try the standard Tuya OpenAPI refresh endpoint
    const url = `${TUYA_ENDPOINTS[this.region]}/v1.0/token/${this.tokens!.refreshToken}`;
    
    const timestamp = Date.now().toString();
    const nonce = crypto.randomUUID();
    const path = `/v1.0/token/${this.tokens!.refreshToken}`;
    const contentHash = crypto.createHash('sha256').update('').digest('hex');
    const stringToSign = ['GET', contentHash, '', path].join('\n');
    const signStr = TUYA_CLIENT_ID + timestamp + nonce + stringToSign;
    const sign = crypto.createHmac('sha256', '').update(signStr).digest('hex').toUpperCase();

    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'client_id': TUYA_CLIENT_ID,
        't': timestamp,
        'sign': sign,
        'sign_method': 'HMAC-SHA256',
        'nonce': nonce,
      },
    });

    const data = response.data;
    if (!data.success || !data.result) {
      throw new Error(`Alternate refresh failed: ${data.msg || 'Unknown error'}`);
    }

    const result = data.result;
    this.tokens = {
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      expiresIn: result.expire_time,
      expiresAt: Date.now() + result.expire_time * 1000,
      uid: result.uid || this.tokens!.uid,
    };

    this.scheduleTokenRefresh();
    this.log?.info('Access token refreshed (alternate), expires in', result.expire_time, 'seconds');

    if (this.onTokenRefresh) {
      this.onTokenRefresh(this.tokens);
    }

    return this.tokens;
  }

  /**
   * Make a request WITHOUT including access_token in the signature.
   * Used for token refresh and initial token requests.
   */
  private async requestWithoutAccessToken<T = unknown>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: object,
  ): Promise<TuyaApiResponse<T>> {
    const timestamp = Date.now().toString();
    const nonce = crypto.randomUUID();

    // Content hash
    const bodyStr = data ? JSON.stringify(data) : '';
    const contentHash = crypto.createHash('sha256').update(bodyStr).digest('hex');

    // Build string to sign (same format)
    const stringToSign = [method.toUpperCase(), contentHash, '', path].join('\n');

    // Build signature WITHOUT access_token (for token refresh/get)
    // Format: client_id + timestamp + nonce + stringToSign
    const signStr = TUYA_CLIENT_ID + timestamp + nonce + stringToSign;
    const sign = crypto
      .createHmac('sha256', '')
      .update(signStr)
      .digest('hex')
      .toUpperCase();

    // Make request directly without using the interceptor
    const url = TUYA_ENDPOINTS[this.region] + path;
    this.log?.debug('Token refresh request to:', url);

    const response: AxiosResponse<TuyaApiResponse<T>> = await axios.request({
      url,
      method,
      data,
      timeout: 15000, // 15 second timeout
      headers: {
        'client_id': TUYA_CLIENT_ID,
        't': timestamp,
        'sign': sign,
        'sign_method': 'HMAC-SHA256',
        'nonce': nonce,
        'Content-Type': 'application/json',
        // Note: NO access_token header for this request type
      },
    });

    this.log?.debug('Token refresh response:', JSON.stringify(response.data));
    return response.data;
  }

  /**
   * Make an authenticated API request
   */
  public async request<T = unknown>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: object,
  ): Promise<TuyaApiResponse<T>> {
    const response: AxiosResponse<TuyaApiResponse<T>> = await this.client.request({
      url: path,
      method,
      data,
    });
    return response.data;
  }

  /**
   * Sign a request according to Tuya's specification
   */
  private signRequest(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
    if (!this.tokens?.accessToken) {
      throw new Error('No access token available. Please link your account first.');
    }

    const timestamp = Date.now().toString();
    const nonce = crypto.randomUUID();
    const method = (config.method || 'GET').toUpperCase();
    const path = config.url || '';

    // Content hash
    const bodyStr = config.data ? JSON.stringify(config.data) : '';
    const contentHash = crypto.createHash('sha256').update(bodyStr).digest('hex');

    // Build string to sign
    const stringToSign = [method, contentHash, '', path].join('\n');

    // Build signature (using empty secret for haauthorize schema)
    const signStr = TUYA_CLIENT_ID + timestamp + this.tokens.accessToken + nonce + stringToSign;
    const sign = crypto
      .createHmac('sha256', '')
      .update(signStr)
      .digest('hex')
      .toUpperCase();

    // Set headers
    config.headers.set('client_id', TUYA_CLIENT_ID);
    config.headers.set('t', timestamp);
    config.headers.set('sign', sign);
    config.headers.set('sign_method', 'HMAC-SHA256');
    config.headers.set('nonce', nonce);
    config.headers.set('access_token', this.tokens.accessToken);
    config.headers.set('Content-Type', 'application/json');

    return config;
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }

    if (!this.tokens) {
      return;
    }

    const refreshIn = this.tokens.expiresAt - Date.now() - 5 * 60 * 1000;
    
    if (refreshIn > 0) {
      this.tokenRefreshTimer = setTimeout(async () => {
        try {
          await this.refreshAccessToken();
        } catch (error) {
          this.log?.error('Failed to refresh token:', error);
        }
      }, refreshIn);
    }
  }

  /**
   * Clean up
   */
  public destroy(): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }
  }
}

// Re-export types
export { TuyaRegion, TuyaTokens, TUYA_ENDPOINTS } from './TuyaLinkingAuth';
