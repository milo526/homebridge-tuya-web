import axios from "axios";
import { Logger } from "homebridge";

const LOGIN_HOST = "https://apigw.iotbing.com";
const CLIENT_ID = "HA_3y9q4ak7g4ephrvke";
const SCHEMA = "haauthorize";
const QR_CODE_HEADER = "tuyaSmart--qrLogin?token=";

export interface LoginTokenResponse {
  uid: string;
  access_token: string;
  refresh_token: string;
  expire_time: number;
  terminal_id: string;
  endpoint: string;
  username: string;
  t: number;
}

export class LoginControl {
  /**
   * Generate a QR code token for pairing.
   * Returns the raw token string and the full QR data to encode.
   */
  public async generateQrCode(
    userCode: string,
    log?: Logger,
  ): Promise<{ token: string; qrData: string }> {
    const url = `${LOGIN_HOST}/v1.0/m/life/home-assistant/qrcode/tokens`;
    const params = {
      clientid: CLIENT_ID,
      usercode: userCode,
      schema: SCHEMA,
    };

    log?.debug("Requesting QR code token...");
    const response = await axios.post(url, null, { params, timeout: 30_000 });
    const data = response.data as {
      success: boolean;
      result?: { qrcode: string };
      code?: number;
      msg?: string;
    };

    if (!data.success || !data.result?.qrcode) {
      throw new Error(
        `Failed to generate QR code: ${data.msg ?? "unknown error"} (code: ${data.code})`,
      );
    }

    const token = data.result.qrcode;
    return {
      token,
      qrData: QR_CODE_HEADER + token,
    };
  }

  /**
   * Poll for login result after the user scans the QR code.
   * Returns null if the user hasn't scanned yet.
   */
  public async checkLoginResult(
    token: string,
    userCode: string,
  ): Promise<LoginTokenResponse | null> {
    const url = `${LOGIN_HOST}/v1.0/m/life/home-assistant/qrcode/tokens/${token}`;
    const params = {
      clientid: CLIENT_ID,
      usercode: userCode,
    };

    const response = await axios.get(url, { params, timeout: 30_000 });
    const data = response.data as {
      success: boolean;
      result?: Record<string, unknown>;
      t?: number;
      code?: number;
      msg?: string;
    };

    if (!data.success) {
      return null;
    }

    const result = data.result!;
    return {
      uid: result.uid as string,
      access_token: result.access_token as string,
      refresh_token: result.refresh_token as string,
      expire_time: result.expire_time as number,
      terminal_id: result.terminal_id as string,
      endpoint: result.endpoint as string,
      username: (result.username as string) ?? "",
      t: data.t ?? Date.now(),
    };
  }

  /**
   * Wait for user to scan QR code with polling.
   * @param timeoutMs How long to wait (default 5 minutes)
   * @param pollIntervalMs How often to poll (default 2 seconds)
   */
  public async waitForLogin(
    token: string,
    userCode: string,
    log?: Logger,
    timeoutMs = 300_000,
    pollIntervalMs = 2_000,
  ): Promise<LoginTokenResponse> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      try {
        const result = await this.checkLoginResult(token, userCode);
        if (result) {
          return result;
        }
      } catch {
        // not ready yet
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      log?.debug("Waiting for QR code scan...");
    }

    throw new Error(
      "QR code login timed out. Please restart Homebridge and try again.",
    );
  }
}
