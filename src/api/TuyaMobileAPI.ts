/**
 * Tuya Mobile API Client
 * 
 * Replicates the logic from tuya-device-sharing-sdk (CustomerApi.py).
 * Used for the `haauthorize` flow which requires encryption and custom signing.
 * 
 * Reference: https://github.com/tuya/tuya-device-sharing-sdk/blob/main/tuya_sharing/customerapi.py
 */

import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import type { Logger } from 'homebridge';
import { TUYA_CLIENT_ID } from './credentials';
import { TuyaTokens } from './TuyaLinkingAuth';

/**
 * Callback type for when tokens need to be refreshed.
 * The callback should perform the refresh and return the new tokens.
 */
export type TokenRefreshHandler = () => Promise<TuyaTokens>;

export class TuyaMobileAPI {
  private client: AxiosInstance;
  private tokens?: TuyaTokens;
  private userCode?: string; 
  private isRefreshing = false;
  private refreshPromise?: Promise<TuyaTokens>;
  private tokenRefreshHandler?: TokenRefreshHandler;

  constructor(
    private readonly baseUrl: string,
    private readonly log?: Logger,
  ) {
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
    });
  }

  public setTokens(tokens: TuyaTokens): void {
    this.tokens = tokens;
  }

  public getTokens(): TuyaTokens | undefined {
    return this.tokens;
  }

  /**
   * Set a handler to be called when tokens need to be refreshed.
   * The handler should perform the actual refresh (e.g., via OpenAPI)
   * and return the new tokens. The MobileAPI will then update its tokens.
   */
  public setTokenRefreshHandler(handler: TokenRefreshHandler): void {
    this.tokenRefreshHandler = handler;
  }

  /**
   * Check if the access token is expired or about to expire
   */
  public isTokenExpired(): boolean {
    if (!this.tokens) {
      return true;
    }
    // Consider token expired if it expires in less than 5 minutes
    return this.tokens.expiresAt < Date.now() + 5 * 60 * 1000;
  }

  /**
   * Ensure we have a valid token before making requests.
   * Delegates to the tokenRefreshHandler if tokens are expired.
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.isTokenExpired()) {
      return;
    }

    if (!this.tokenRefreshHandler) {
      throw new Error('Token expired. Please re-link your Tuya account.');
    }

    // Prevent concurrent refresh attempts
    if (this.isRefreshing && this.refreshPromise) {
      await this.refreshPromise;
      return;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.tokenRefreshHandler();

    try {
      const newTokens = await this.refreshPromise;
      this.tokens = newTokens;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = undefined;
    }
  }

  /**
   * Make a request to the Mobile API
   */
  public async request<T = unknown>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    params: Record<string, unknown> = {},
    body: Record<string, unknown> = {},
  ): Promise<{ success: boolean; result?: T; msg?: string; code?: number }> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available. Cannot sign Mobile API request.');
    }

    // Ensure we have a valid (non-expired) token before making the request
    await this.ensureValidToken();

    // 1. Generate Request ID (rid)
    const rid = crypto.randomUUID();
    
    // 2. Derive Secret Key
    // md5 = hashlib.md5()
    // rid_refresh_token = rid + self.token_info.refresh_token
    // md5.update(rid_refresh_token.encode('utf-8'))
    // hash_key = md5.hexdigest()
    const hashKey = crypto.createHash('md5')
      .update(rid + this.tokens.refreshToken)
      .digest('hex');

    // secret = _secret_generating(rid, sid, hash_key)
    const secret = this.generateSecret(rid, '', hashKey);

    // 3. Encrypt Params and Body
    let queryEncData = '';
    let finalParams = { ...params };
    
    if (Object.keys(params).length > 0) {
      // query_encdata = _form_to_json(params)
      // query_encdata = _aes_gcm_encrypt(query_encdata, secret)
      const jsonParams = JSON.stringify(params);
      queryEncData = this.encryptAesGcm(jsonParams, secret);
      finalParams = { encdata: queryEncData };
    }

    let bodyEncData = '';
    let finalBody = { ...body };

    if (Object.keys(body).length > 0) {
      const jsonBody = JSON.stringify(body);
      bodyEncData = this.encryptAesGcm(jsonBody, secret);
      finalBody = { encdata: bodyEncData };
    }

    // 4. Time
    const t = Date.now().toString();

    // 5. Headers
    const headers: Record<string, string> = {
      'X-appKey': TUYA_CLIENT_ID,
      'X-requestId': rid,
      'X-time': t,
    };
    
    // Only add optional headers if present
    const sid = ''; 
    if (sid) {
      headers['X-sid'] = sid;
    }
    if (this.tokens.accessToken) {
      headers['X-token'] = this.tokens.accessToken;
    }

    // 6. Sign
    // sign = _restful_sign(hash_key, query_encdata, body_encdata, headers)
    const sign = this.signRequest(hashKey, queryEncData, bodyEncData, headers);
    headers['X-sign'] = sign;

    try {
      if (this.log?.debug) { 
        this.log.debug(`MobileAPI Request: ${method} ${path}`);
        if (bodyEncData) {
          this.log.debug(`MobileAPI Body (Pre-Enc): ${JSON.stringify(body)}`);
        }
        this.log.debug(`MobileAPI SignStr: ${this.lastSignStr || 'Unknown'}`); // Need to capture signStr
      }
      
      const response = await this.client.request({
        url: path,
        method,
        params: finalParams,
        data: Object.keys(finalBody).length > 0 ? finalBody : undefined,
        headers,
      });

      const ret = response.data;
      
      if (!ret.success) {
        return { success: false, msg: ret.msg, code: ret.code };
      }

      // Decrypt result
      // result = _aex_gcm_decrypt(ret.get("result"), secret)
      let result = ret.result;
      if (typeof result === 'string') {
        try {
          const decrypted = this.decryptAesGcm(result, secret);
          try {
            result = JSON.parse(decrypted);
          } catch {
            result = decrypted;
          }
        } catch (error) {
          this.log?.error('Failed to decrypt response', error);
          throw new Error('Response decryption failed');
        }
      }

      return { success: true, result };

    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      this.log?.error('MobileAPI Request Failed:', error.message);
      if (error.response) {
        return { success: false, msg: error.response.data?.msg || error.message, code: error.response.data?.code };
      }
      return { success: false, msg: error.message };
    }
  }

  // _secret_generating in SDK
  private generateSecret(rid: string, sid: string, hashKey: string): string {
    let message = hashKey;
    const mod = 16;
    
    if (sid) {
      const sidLength = sid.length;
      const length = sidLength < mod ? sidLength : mod;
      let ecode = '';
      for (let i = 0; i < length; i++) {
        const idx = sid.charCodeAt(i) % mod;
        ecode += sid[idx];
      }
      message += '_' + ecode;
    }

    // checksum = hmac.new(rid, message, hashlib.sha256)
    // byte_temp = checksum.digest()
    // secret = byte_temp.hex()
    // return secret[:16]
    
    const hmac = crypto.createHmac('sha256', rid); // rid is key? Python: hmac.new(key, msg, digest) -> rid is key
    hmac.update(message);
    const secret = hmac.digest('hex');
    
    return secret.substring(0, 16);
  }

  // helper
  private lastSignStr = '';

  // _restful_sign in SDK
  private signRequest(
    hashKey: string, 
    queryEncData: string, 
    bodyEncData: string, 
    headers: Record<string, string>,
  ): string {
    const headerKeys = ['X-appKey', 'X-requestId', 'X-sid', 'X-time', 'X-token'];
    let headerSignStr = '';
    
    for (const key of headerKeys) {
      const val = headers[key] || ''; // SDK uses empty string if missing
      if (val !== '') {
        headerSignStr += key + '=' + val + '||';
      }
    }
    
    // sign_str = header_sign_str[:-2]
    if (headerSignStr.endsWith('||')) {
      headerSignStr = headerSignStr.slice(0, -2);
    }
    
    let signStr = headerSignStr;
    
    if (queryEncData) {
      signStr += queryEncData;
    }
    if (bodyEncData) {
      signStr += bodyEncData;
    }
    
    const hmac = crypto.createHmac('sha256', hashKey);
    hmac.update(signStr);
    this.lastSignStr = signStr; // Capture for debugging
    return hmac.digest('hex');
  }

  // _aes_gcm_encrypt
  private encryptAesGcm(rawData: string, secret: string): string {
    // nonce = _random_nonce(12)
    const nonce = this.randomNonce(12);
    
    // cipher = AESGCM(secret) (secret is hex string from generateSecret? No, SDK uses secret encoded as utf-8)
    // SDK: secret = secret.encode('utf-8') ... cipher = AESGCM(secret)
    // In Node createCipheriv requires Buffer or key string.
    
    const secretBuf = Buffer.from(secret, 'utf-8');
    const nonceBuf = Buffer.from(nonce, 'utf-8'); // SDK: nonce encoded to utf-8!
    
    const cipher = crypto.createCipheriv('aes-128-gcm', secretBuf, nonceBuf);
    
    let encrypted = cipher.update(rawData, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const tag = cipher.getAuthTag();
    
    // ciphertext = cipher.encrypt(...) -> returns ciphertext + tag in Python cryptography?
    // SDK: base64.b64encode(nonce) + base64.b64encode(ciphertext)
    // Wait, Python AESGCM.encrypt result includes tag. 
    // So "ciphertext" in SDK code includes tag.
    
    const ciphertextWithTag = Buffer.concat([encrypted, tag]);
    
    const b64Nonce = nonceBuf.toString('base64');
    const b64Cipher = ciphertextWithTag.toString('base64');
    
    return b64Nonce + b64Cipher;
  }

  // _aex_gcm_decrypt
  private decryptAesGcm(cipherData: string, secret: string): string {
    // Python code:
    // cipher_data = base64.b64decode(cipher_data) -- Wait, what?
    // SDK returns: base64(nonce) + base64(ciphertext) as string.
    // SDK decrypt:
    // cipher_data = base64.b64decode(cipher_data) 
    // nonce = cipher_data[:12]
    // cipher_text = cipher_data[12:]
    
    // BUT WAIT! In Encrypt it blindly concats two base64 strings!
    // base64(nonce_12_bytes) -> 16 chars
    // So likely the logic assumes fixed width nonce base64?
    
    // Let's re-read the SDK decrypt function carefully.
    // _aes_gcm_encrypt returns: base64.b64encode(nonce) + base64.b64encode(ciphertext)
    // These are bytes objects in Python 3. Str conversion makes them "b'...'".
    // SDK: query_encdata = str(query_encdata, encoding="utf8") -> converts bytes to string.
    
    // _aex_gcm_decrypt(cipher_data, secret):
    // cipher_data = base64.b64decode(cipher_data)
    
    // THIS IS WEIRD. If you concat two base64 strings, you can't just decode the whole thing and expect it to split perfectly unless...
    // Ah, maybe `cipher_data` passed to decrypt is NOT the same format as what is sent?
    // No, `result = _aex_gcm_decrypt(ret.get("result"), secret)`
    
    // If the server returns data in the same format: base64(nonce) + base64(ciphertext)
    // But b64decode on that string might fail or produce garbage if executed on the whole string.
    
    // Unless Tuya server output is different?
    // Or maybe the nonce is fixed length?
    // 12 bytes = 16 base64 chars.
    
    // Let's assume the input string is `BASE64_NONCE` + `BASE64_CIPHER`.
    // Valid base64 nonce (12 bytes) is always 16 chars.
    // So we can split it safely?
    // But `base64.b64decode(cipher_data)` suggests it decodes the *whole* string.
    
    // If I look at the Python code again:
    // `cipher_data = base64.b64decode(cipher_data)`
    // This implies `cipher_data` is a SINGLE base64 string.
    // But `_aes_gcm_encrypt` produces TWO concatenated base64 strings.
    // Does the server return a single base64 string?
    
    // HYPOTHESIS: The server response `result` IS a single base64 string which decodes to `nonce + ciphertext + tag`.
    // AND `_aes_gcm_encrypt` is used for *requests*. 
    // Maybe `encdata` param expects the custom format (B64Size1 + B64Size2)?
    // Or maybe Python b64decode handles concatenated b64 strings? (No, it doesn't).
    
    // Let's follow SDK decrypt logic exactly:
    // It calls `base64.b64decode(cipher_data)`.
    // This strongly suggests the server returns ONE standard base64 string.
    
    // And what about REQUEST?
    // `query_encdata = base64.b64encode(nonce) + base64.b64encode(ciphertext)`
    // Sent as `encdata` param.
    // Yes, for requests we send that custom concatenated string.
    
    // For DECRYPT (Responses):
    // We treat the input as a single base64 string.
    
    const fullBuffer = Buffer.from(cipherData, 'base64');
    
    // nonce = cipher_data[:12]
    const nonce = fullBuffer.subarray(0, 12);
    // cipher_text = cipher_data[12:] (includes tag at end)
    const ciphertextWithTag = fullBuffer.subarray(12);
    
    // Tag is last 16 bytes for auth tag
    const tag = ciphertextWithTag.subarray(ciphertextWithTag.length - 16);
    const ciphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - 16);
    
    const secretBuf = Buffer.from(secret, 'utf-8');
    
    const decipher = crypto.createDecipheriv('aes-128-gcm', secretBuf, nonce);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  }

  // _random_nonce
  private randomNonce(length: number): string {
    const chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
