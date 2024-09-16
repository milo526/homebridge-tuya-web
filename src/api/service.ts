import { Logger } from "homebridge";
import {
  AuthenticationError,
  RateLimitError,
  UnsupportedOperationError,
} from "../errors";
import axios, { AxiosRequestConfig } from "axios";
import { Session } from "./session";
import {
  DeviceQueryPayload,
  DeviceState,
  DiscoveryPayload,
  TuyaApiMethod,
  TuyaApiPayload,
  TuyaDevice,
  TuyaRequestHeader,
  TuyaResponseHeader,
} from "./response";
import { TuyaPlatform } from "./platform";
import delay from "../helpers/delay";
import { DeviceOfflineError } from "../errors/DeviceOfflineError";
import { URLSearchParams } from "url";

export class TuyaWebApi {
  private session: Session | undefined;
  private authBaseUrl = "https://px1.tuyaeu.com";

  constructor(
    private username: string,
    private password: string,
    private countryCode: string,
    private tuyaPlatform: TuyaPlatform = "tuya",
    private log?: Logger,
  ) {}

  public async getAllDeviceStates(): Promise<TuyaDevice[] | undefined> {
    return this.discoverDevices();
  }

  public async discoverDevices(): Promise<TuyaDevice[] | undefined> {
    if (!this.session?.hasValidToken()) {
      throw new Error("No valid token");
    }

    const { data } = await this.sendRequest<DiscoveryPayload>(
      "/homeassistant/skill",
      {
        header: {
          name: "Discovery",
          namespace: "discovery",
          payloadVersion: 1,
        },
        payload: {
          accessToken: this.session.accessToken,
        },
      },
      "GET",
    );

    if (data.header && data.header.code === "SUCCESS") {
      return data.payload.devices;
    } else {
      if (data.header && data.header.code === "FrequentlyInvoke") {
        throw new RateLimitError("Requesting too quickly.", data.header.msg);
      } else {
        throw new Error(`No valid response from API: ${JSON.stringify(data)}`);
      }
    }
  }

  public async getDeviceState(deviceId: string): Promise<DeviceState> {
    if (!this.session?.hasValidToken()) {
      throw new Error("No valid token");
    }

    const { data } = await this.sendRequest<DeviceQueryPayload>(
      "/homeassistant/skill",
      {
        header: {
          name: "QueryDevice",
          namespace: "query",
          payloadVersion: 1,
        },
        payload: {
          accessToken: this.session.accessToken,
          devId: deviceId,
          value: 1,
        },
      },
      "GET",
    );

    if (data.header && data.header.code === "SUCCESS") {
      return data.payload.data;
    } else {
      if (data.header && data.header.code === "FrequentlyInvoke") {
        throw new RateLimitError("Requesting too quickly.", data.header.msg);
      } else {
        throw new Error(`No valid response from API: ${JSON.stringify(data)}`);
      }
    }
  }

  public async setDeviceState<Method extends TuyaApiMethod>(
    deviceId: string,
    method: Method,
    payload: TuyaApiPayload<Method>,
  ): Promise<void> {
    if (!this.session?.hasValidToken()) {
      throw new Error("No valid token");
    }

    const { data } = await this.sendRequest(
      "/homeassistant/skill",
      {
        header: {
          name: method,
          namespace: "control",
          payloadVersion: 1,
        },
        payload: {
          ...payload,
          accessToken: this.session?.accessToken,
          devId: deviceId,
        },
      },
      "POST",
    );

    if (data.header && data.header.code === "SUCCESS") {
      return;
    } else if (data.header && data.header.code === "FrequentlyInvoke") {
      throw new RateLimitError("Requesting too quickly.", data.header.msg);
    } else if (data.header && data.header.code === "UnsupportedOperation") {
      throw new UnsupportedOperationError(
        "Unsupported Operation",
        "The action you tried to perform is not valid for the current device. Please disable it.",
      );
    } else if (data.header && data.header.code === "TargetOffline") {
      throw new DeviceOfflineError();
    } else {
      throw new Error(`Invalid payload in response: ${JSON.stringify(data)}`);
    }
  }

  public async getOrRefreshToken(retryingAfterError = false): Promise<Session> {
    let data: Record<string, unknown> & { header: TuyaResponseHeader };

    if (!this.session?.hasToken()) {
      this.log?.debug("Requesting new token");
      // No token, lets get a token from the Tuya Web API
      if (!this.username) {
        throw new AuthenticationError("No username configured");
      }
      if (!this.password) {
        throw new AuthenticationError("No password configured");
      }
      if (!this.countryCode) {
        throw new AuthenticationError("No country code configured");
      }

      const formData = new URLSearchParams({
        userName: this.username,
        password: this.password,
        countryCode: this.countryCode,
        bizType: this.tuyaPlatform,
        from: "tuya",
      }).toString();
      const contentLength = formData.length;

      data = (
        await axios<Record<string, unknown> & { header: TuyaResponseHeader }>({
          headers: {
            "Content-Length": `${contentLength}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          url: "/homeassistant/auth.do",
          baseURL: this.authBaseUrl,
          data: formData,
          method: "POST",
        })
      ).data;
    } else {
      this.log?.debug("Refreshing token");
      // Refresh token
      data = (
        await this.sendRequest(
          "/homeassistant/access.do?grant_type=refresh_token&refresh_token=" +
            this.session.refreshToken,
          {},
          "GET",
        )
      ).data;
    }

    if (data.responseStatus === "error") {
      if (typeof data.errorMsg === "string" && !retryingAfterError) {
        // If we are requesting tokens too often we get an error: like "you cannot auth exceed once in 180 seconds"
        const matches = data.errorMsg.match(
          /you cannot auth exceed once in (\d+) seconds/,
        );

        if (matches) {
          const waitTime = parseInt(matches[1]) + 5;
          this.log?.warn(`Cannot acquire token, waiting ${waitTime} seconds.`);
          await delay(waitTime * 1000);
          this.log?.info("Retrying authentication after previous error.");
          return this.getOrRefreshToken(true);
        }
      }

      throw new AuthenticationError(
        data.errorMsg?.toString() ?? JSON.stringify(data),
      );
    }

    if (!Session.isValidSessionData(data)) {
      throw new AuthenticationError(
        `Invalid session data: ${JSON.stringify(data)}`,
      );
    }

    if (!this.session?.hasToken()) {
      this.session = new Session(
        data.access_token,
        data.refresh_token,
        data.expires_in,
        data.access_token.substring(0, 2),
      );
    } else {
      this.session.resetToken(
        data.access_token,
        data.refresh_token,
        data.expires_in,
      );
    }

    setTimeout(
      () => {
        void this.getOrRefreshToken();
      },
      (data.expires_in - 60 * 60) * 1000,
    );

    return this.session;
  }

  /*
   * --------------------------------------
   * HTTP methods
   */

  public async sendRequest<T = Record<string, unknown>>(
    url: AxiosRequestConfig["url"],
    data: { header?: TuyaRequestHeader } & Record<string, unknown>,
    method: AxiosRequestConfig["method"],
  ): Promise<{ data: T & { header: TuyaResponseHeader } }> {
    this.log?.debug(
      "Sending HTTP %s request to %s - Header: %s.",
      method,
      url,
      JSON.stringify(data.header),
    );
    const response = await axios({
      baseURL: this.session?.areaBaseUrl,
      url,
      data,
      method,
    });

    return { data: response.data as T & { header: TuyaResponseHeader } };
  }
}
