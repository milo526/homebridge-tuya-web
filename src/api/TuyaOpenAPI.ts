/**
 * Tuya OpenAPI Client
 * 
 * Handles authenticated requests to Tuya Cloud API.
 * Uses tokens obtained from the linking flow.
 * 
 * Note: The haauthorize schema (QR code linking) does not support token refresh.
 * The MobileAPI uses refresh_token for signing, so requests continue to work
 * indefinitely without needing to refresh tokens.
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

export class TuyaOpenAPI {
  private client: AxiosInstance;
  private tokens?: TuyaTokens;

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
   * Set tokens from linking flow or stored config
   */
  public setTokens(tokens: TuyaTokens): void {
    this.tokens = tokens;
  }

  /**
   * Get current tokens (for saving to config)
   */
  public getTokens(): TuyaTokens | undefined {
    return this.tokens;
  }

  /**
   * Check if we have tokens
   */
  public hasValidTokens(): boolean {
    return !!this.tokens?.refreshToken;
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
   * Clean up (no-op, kept for API compatibility)
   */
  public destroy(): void {
    // No cleanup needed
  }
}

// Re-export types
export { TuyaRegion, TuyaTokens, TUYA_ENDPOINTS } from './TuyaLinkingAuth';
