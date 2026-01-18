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
   */
  public async refreshAccessToken(): Promise<TuyaTokens> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.request<{
      access_token: string;
      refresh_token: string;
      expire_time: number;
      uid: string;
    }>(`/v1.0/token/${this.tokens.refreshToken}`, 'GET');

    if (!response.success || !response.result) {
      throw new Error(`Failed to refresh token: ${response.msg}`);
    }

    const { access_token, refresh_token, expire_time, uid } = response.result;
    
    this.tokens = {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expire_time,
      expiresAt: Date.now() + expire_time * 1000,
      uid,
    };

    this.scheduleTokenRefresh();
    this.log?.debug('Refreshed access token, expires in', expire_time, 'seconds');

    // Notify callback so platform can persist tokens and sync with other APIs
    if (this.onTokenRefresh) {
      this.onTokenRefresh(this.tokens);
    }

    return this.tokens;
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
