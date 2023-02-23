import { Logger } from "homebridge";
import {
  AuthenticationError,
  RatelimitError,
  UnsupportedOperationError,
} from "../errors";
import querystring from "querystring";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { Session } from "./session";
import {
  DeviceQueryPayload,
  DeviceState,
  DiscoveryPayload,
  TuyaApiMethod,
  TuyaApiPayload,
  TuyaDevice,
  TuyaHeader,
} from "./response";
import { TuyaPlatform } from "./platform";
import delay from "../helpers/delay";
import { DeviceOfflineError } from "../errors/DeviceOfflineError";

export class TuyaWebApi {
  private session: Session | undefined;
  private authBaseUrl = "https://px1.tuyaeu.com";

  constructor(
    private username: string,
    private password: string,
    private countryCode: string,
    private tuyaPlatform: TuyaPlatform = "tuya",
    private log?: Logger,
    private authTokenWaitTime: number = 180
  ) { }

  public async getAllDeviceStates(): Promise<TuyaDevice[] | undefined> {
    return this.discoverDevices();
  }

  public async discoverDevices(): Promise<TuyaDevice[] | undefined> {
    if (this.session == null) {
      throw new Error("Sessions object is null");
    }
    if (!this.session.hasValidToken()) {
      this.getOrRefreshToken();
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
      "GET"
    );

    if (data.header && data.header.code === "SUCCESS") {
      return data.payload.devices;
    } else {
      if (data.header && data.header.code === "FrequentlyInvoke") {
        throw new RatelimitError("Requesting too quickly.", data.header.msg);
      } else {
        throw new Error(`No valid response from API: ${JSON.stringify(data)}`);
      }
    }
  }

  public async getDeviceState(deviceId: string): Promise<DeviceState> {
    if (this.session == null) {
      throw new Error("Sessions object is null");
    }
    if (!this.session.hasValidToken()) {
      this.getOrRefreshToken();
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
      "GET"
    );

    if (data.header && data.header.code === "SUCCESS") {
      return data.payload.data;
    } else {
      if (data.header && data.header.code === "FrequentlyInvoke") {
        throw new RatelimitError("Requesting too quickly.", data.header.msg);
      } else {
        throw new Error(`No valid response from API: ${JSON.stringify(data)}`);
      }
    }
  }

  public async setDeviceState<Method extends TuyaApiMethod>(
    deviceId: string,
    method: Method,
    payload: TuyaApiPayload<Method>
  ): Promise<void> {
    if (this.session == null) {
      throw new Error("Sessions object is null");
    }
    if (!this.session.hasValidToken()) {
      this.getOrRefreshToken();
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
      "POST"
    );

    if (data.header && data.header.code === "SUCCESS") {
      return;
    } else if (data.header && data.header.code === "FrequentlyInvoke") {
      throw new RatelimitError("Requesting too quickly.", data.header.msg);
    } else if (data.header && data.header.code === "UnsupportedOperation") {
      throw new UnsupportedOperationError(
        "Unsupported Operation",
        "The action you tried to perform is not valid for the current device. Please disable it."
      );
    } else if (data.header && data.header.code === "TargetOffline") {
      throw new DeviceOfflineError();
    } else {
      throw new Error(`Invalid payload in response: ${JSON.stringify(data)}`);
    }
  }

  public async getOrRefreshToken(retryingAfterError = false): Promise<Session> {
    let data: AxiosResponse["data"];
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

      const form = {
        userName: this.username,
        password: this.password,
        countryCode: this.countryCode,
        bizType: this.tuyaPlatform,
        from: "tuya",
      };

      const formData = querystring.stringify(form);
      const contentLength = formData.length;

      data = (
        await axios({
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
          "GET"
        )
      ).data;
    }

    if (data.responseStatus === "error") {
      if (data.errorMsg.includes("you cannot auth exceed once in")) {
        if (!retryingAfterError) {
          this.log?.warn("Cannot acquire token, waiting ${this.authTokenWaitTime} seconds.");
          await delay(this.authTokenWaitTime * 1000);
          this.log?.info("Retrying authentication after previous error.");
          return this.getOrRefreshToken(true);
        } else {
          this.log?.warn("Got again auth error, even after delaying for {this.authTokenWaitTime * 1000} seconds.");
          throw new AuthenticationError(data.errorMsg);
        }
      } else {
        this.log?.error("Got auth error " + data.errorMsg);
        throw new AuthenticationError(data.errorMsg);
      }
    }

    if (!this.session?.hasToken()) {
      this.session = new Session(
        data.access_token,
        data.refresh_token,
        data.expires_in,
        data.access_token.substr(0, 2)
      );
    } else {
      this.session.resetToken(
        data.access_token,
        data.refresh_token,
        data.expires_in
      );
    }

    setTimeout(() => {
      this.getOrRefreshToken();
    }, (data.expires_in - 60 * 60) * 1000);

    return this.session;
  }

  /*
   * --------------------------------------
   * HTTP methods
   */

  public async sendRequest<T = Record<string, unknown>>(
    url: AxiosRequestConfig["url"],
    data: AxiosRequestConfig["data"],
    method: AxiosRequestConfig["method"]
  ): Promise<{ data: T & { header: TuyaHeader } }> {
    this.log?.debug(
      "Sending HTTP %s request to %s - Header: %s.",
      method,
      url,
      JSON.stringify(data.header)
    );
    const response = await axios({
      baseURL: this.session?.areaBaseUrl,
      url,
      data,
      method,
    });

    return { data: response.data };
  }
}
