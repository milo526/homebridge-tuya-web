import crypto from "crypto";
import axios, { AxiosInstance } from "axios";
import { Logger } from "homebridge";

const REQUEST_TIMEOUT = 30_000;

export interface CustomerTokenInfo {
  access_token: string;
  refresh_token: string;
  uid: string;
  expire_time: number;
  t: number;
}

export interface SharingTokenListener {
  updateToken(tokenInfo: CustomerTokenInfo): void;
}

export class CustomerApi {
  private session: AxiosInstance;
  public tokenInfo: CustomerTokenInfo;
  private refreshingToken = false;

  constructor(
    tokenInfo: CustomerTokenInfo,
    private clientId: string,
    private userCode: string,
    private endpoint: string,
    private tokenListener?: SharingTokenListener,
    private log?: Logger,
  ) {
    this.tokenInfo = tokenInfo;
    this.session = axios.create({ timeout: REQUEST_TIMEOUT });
  }

  private async request<T = Record<string, unknown>>(
    method: string,
    path: string,
    params?: Record<string, unknown>,
    body?: Record<string, unknown>,
  ): Promise<{ success: boolean; result: T; code?: number; msg?: string; t?: number }> {
    await this.refreshAccessTokenIfNeeded();

    const rid = crypto.randomUUID();
    const sid = "";
    const hashKey = crypto
      .createHash("md5")
      .update(rid + this.tokenInfo.refresh_token)
      .digest("hex");
    const secret = secretGenerating(rid, sid, hashKey);

    let queryEncdata = "";
    let processedParams: Record<string, string> | undefined;
    if (params && Object.keys(params).length > 0) {
      const json = JSON.stringify(params);
      const encrypted = aesGcmEncrypt(json, secret);
      queryEncdata = encrypted;
      processedParams = { encdata: encrypted };
    }

    let bodyEncdata = "";
    let processedBody: Record<string, string> | undefined;
    if (body && Object.keys(body).length > 0) {
      const json = JSON.stringify(body);
      const encrypted = aesGcmEncrypt(json, secret);
      bodyEncdata = encrypted;
      processedBody = { encdata: encrypted };
    }

    const t = Date.now();
    const headers: Record<string, string> = {
      "X-appKey": this.clientId,
      "X-requestId": rid,
      "X-sid": sid,
      "X-time": String(t),
    };
    if (this.tokenInfo.access_token) {
      headers["X-token"] = this.tokenInfo.access_token;
    }

    headers["X-sign"] = restfulSign(
      hashKey,
      queryEncdata,
      bodyEncdata,
      headers,
    );

    this.log?.debug("CustomerApi %s %s", method, path);

    const response = await this.session.request({
      method,
      url: this.endpoint + path,
      params: processedParams,
      data: processedBody,
      headers,
      timeout: REQUEST_TIMEOUT,
    });

    const ret = response.data as {
      success: boolean;
      result: string;
      code?: number;
      msg?: string;
      t?: number;
    };

    if (!ret.success) {
      throw new Error(`API error (${ret.code}): ${ret.msg}`);
    }

    let decryptedResult: T;
    try {
      const decrypted = aesGcmDecrypt(ret.result, secret);
      try {
        decryptedResult = JSON.parse(decrypted) as T;
      } catch {
        decryptedResult = decrypted as unknown as T;
      }
    } catch {
      decryptedResult = ret.result as unknown as T;
    }

    return {
      success: ret.success,
      result: decryptedResult,
      code: ret.code,
      msg: ret.msg,
      t: ret.t,
    };
  }

  public async refreshAccessTokenIfNeeded(): Promise<void> {
    if (this.refreshingToken) {return;}

    const now = Date.now();
    const expiredTime = this.tokenInfo.expire_time;
    if (expiredTime - 60_000 > now) {return;}

    this.refreshingToken = true;
    try {
      const response = await this.get<{
        accessToken: string;
        refreshToken: string;
        uid: string;
        expireTime: number;
      }>(`/v1.0/m/token/${this.tokenInfo.refresh_token}`);

      if (response.success) {
        const result = response.result;
        const newTokenInfo: CustomerTokenInfo = {
          t: response.t ?? Date.now(),
          expire_time:
            (response.t ?? Date.now()) + (result.expireTime ?? 7200) * 1000,
          uid: result.uid,
          access_token: result.accessToken,
          refresh_token: result.refreshToken,
        };
        this.tokenInfo = newTokenInfo;
        this.tokenListener?.updateToken(newTokenInfo);
        this.log?.info("Tuya token refreshed successfully");
      }
    } catch (e) {
      this.log?.error(
        "Failed to refresh token: %s",
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      this.refreshingToken = false;
    }
  }

  public async get<T = Record<string, unknown>>(
    path: string,
    params?: Record<string, unknown>,
  ) {
    return this.request<T>("GET", path, params);
  }

  public async post<T = Record<string, unknown>>(
    path: string,
    params?: Record<string, unknown>,
    body?: Record<string, unknown>,
  ) {
    return this.request<T>("POST", path, params, body);
  }
}

// ---------- Crypto utilities (ported from tuya-device-sharing-sdk) ----------

function randomNonce(length: number): string {
  const chars = "ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function secretGenerating(rid: string, sid: string, hashKey: string): string {
  let message = hashKey;
  const mod = 16;
  if (sid) {
    const length = Math.min(sid.length, mod);
    let ecode = "";
    for (let i = 0; i < length; i++) {
      const idx = sid.charCodeAt(i) % mod;
      ecode += sid[idx] ?? "";
    }
    message += "_" + ecode;
  }

  const hmac = crypto.createHmac("sha256", Buffer.from(rid, "utf8"));
  hmac.update(Buffer.from(message, "utf8"));
  const hex = hmac.digest("hex");
  return hex.substring(0, 16);
}

function aesGcmEncrypt(rawData: string, secret: string): string {
  const nonce = randomNonce(12);
  const nonceBuffer = Buffer.from(nonce, "utf8");
  const secretBuffer = Buffer.from(secret, "utf8");

  const cipher = crypto.createCipheriv("aes-128-gcm", secretBuffer, nonceBuffer);
  const encrypted = Buffer.concat([
    cipher.update(rawData, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const ciphertext = Buffer.concat([encrypted, authTag]);

  return nonceBuffer.toString("base64") + ciphertext.toString("base64");
}

function aesGcmDecrypt(cipherData: string, secret: string): string {
  const decoded = Buffer.from(cipherData, "base64");
  const nonce = decoded.subarray(0, 12);
  const ciphertextWithTag = decoded.subarray(12);

  const secretBuffer = Buffer.from(secret, "utf8");
  const authTag = ciphertextWithTag.subarray(ciphertextWithTag.length - 16);
  const encrypted = ciphertextWithTag.subarray(
    0,
    ciphertextWithTag.length - 16,
  );

  const decipher = crypto.createDecipheriv("aes-128-gcm", secretBuffer, nonce);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function restfulSign(
  hashKey: string,
  queryEncdata: string,
  bodyEncdata: string,
  data: Record<string, string>,
): string {
  const headerKeys = ["X-appKey", "X-requestId", "X-sid", "X-time", "X-token"];
  let headerSignStr = "";
  for (const key of headerKeys) {
    const val = data[key] ?? "";
    if (val) {
      headerSignStr += key + "=" + val + "||";
    }
  }
  let signStr = headerSignStr.substring(0, headerSignStr.length - 2);

  if (queryEncdata) {signStr += queryEncdata;}
  if (bodyEncdata) {signStr += bodyEncdata;}

  const hmac = crypto.createHmac(
    "sha256",
    Buffer.from(hashKey, "utf8"),
  );
  hmac.update(Buffer.from(signStr, "utf8"));
  return hmac.digest("hex");
}
