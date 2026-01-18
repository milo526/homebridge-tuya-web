/**
 * Token Storage Helper
 * 
 * Persists Tuya tokens to Homebridge's storage directory so they survive restarts.
 * Tokens are saved when refreshed and loaded on startup.
 */

import { API } from 'homebridge';
import { promises as fs } from 'fs';
import path from 'path';
import type { TuyaTokens } from '../api/TuyaLinkingAuth';

const TOKEN_FILE_NAME = 'tuya-tokens.json';

export class TokenStorage {
  private readonly filePath: string;

  constructor(api: API) {
    // Use Homebridge's persist directory for token storage
    this.filePath = path.join(api.user.storagePath(), TOKEN_FILE_NAME);
  }

  /**
   * Save tokens to persistent storage
   */
  public async saveTokens(tokens: TuyaTokens): Promise<void> {
    try {
      const data = JSON.stringify(tokens, null, 2);
      await fs.writeFile(this.filePath, data, 'utf-8');
    } catch (error) {
      // Log but don't throw - token save failure shouldn't crash the plugin
      console.error('[TokenStorage] Failed to save tokens:', error);
    }
  }

  /**
   * Load tokens from persistent storage
   */
  public async loadTokens(): Promise<TuyaTokens | null> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const tokens = JSON.parse(data) as TuyaTokens;
      
      // Validate the loaded tokens have required fields
      if (tokens.accessToken && tokens.refreshToken && tokens.expiresAt) {
        return tokens;
      }
      return null;
    } catch (error) {
      // File doesn't exist or is invalid - return null
      return null;
    }
  }

  /**
   * Clear stored tokens
   */
  public async clearTokens(): Promise<void> {
    try {
      await fs.unlink(this.filePath);
    } catch {
      // Ignore errors when file doesn't exist
    }
  }
}
