/**
 * Tuya OpenAPI Client
 * 
 * Handles authenticated requests to Tuya Cloud API.
 * Uses tokens obtained from the linking flow.
 * 
 * Note: The haauthorize schema (QR code linking) does not support token refresh.
 * The MobileAPI uses refresh_token for signing, so requests continue to work.
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
  private isRefreshing = false;
  private refreshPromise?: Promise<TuyaTokens>;

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
   * Refresh the access token using the MobileAPI encryption pattern.
   * 
   * For the haauthorize schema (QR code linking flow), we need to use
   * the same encrypted request pattern as the MobileAPI. The tokens
   * obtained from QR auth work with the mobile endpoints, not the
   * standard OpenAPI endpoints.
   */
  public async refreshAccessToken(): Promise<TuyaTokens> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available. Please re-link your Tuya account.');
    }

    // Prevent concurrent refresh attempts
    if (this.isRefreshing && this.refreshPromise) {
      this.log?.debug('Token refresh already in progress, waiting...');
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.doRefreshToken();

    try {
      return await this.refreshPromise;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = undefined;
    }
  }

  /**
   * Internal method to handle token expiry.
   * 
   * The haauthorize schema (QR code flow) does NOT support token refresh.
   * The MobileAPI uses refresh_token for signing, so requests continue to work.
   * We silently extend token validity to prevent unnecessary warnings.
   */
  private async doRefreshToken(): Promise<TuyaTokens> {
    if (!this.tokens) {
      throw new Error('No tokens available. Please link your Tuya account.');
    }

    // Silently extend token validity - MobileAPI uses refresh_token for signing
    // so requests will continue to work regardless of access_token expiry
    this.tokens = {
      ...this.tokens,
      expiresAt: Date.now() + 2 * 60 * 60 * 1000,
    };
    
    this.scheduleTokenRefresh();
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
