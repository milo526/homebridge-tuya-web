import { Logger } from "homebridge";
import {
  RateLimitError,
  UnsupportedOperationError,
} from "../errors";
import { CustomerApi, CustomerTokenInfo, SharingTokenListener } from "./customerApi";
import { LoginControl, LoginTokenResponse } from "./loginControl";
import {
  CATEGORY_TO_DEV_TYPE,
  CoverState,
  DEV_TYPE_TO_HA_TYPE,
  DeviceCodeMapping,
  DeviceState,
  TuyaApiMethod,
  TuyaApiPayload,
  TuyaDevice,
  TuyaDeviceType,
} from "./response";
import { DeviceOfflineError } from "../errors/DeviceOfflineError";
import { AuthenticationError } from "../errors";
import * as fs from "fs";
import * as path from "path";
import QRCode from "qrcode";

interface StoredTokenData {
  user_code: string;
  token_info: CustomerTokenInfo;
  terminal_id: string;
  endpoint: string;
}

interface CloudDevice {
  id: string;
  name: string;
  category: string;
  online: boolean;
  product_id?: string;
  product_name?: string;
  status: { code: string; value: unknown }[];
  [key: string]: unknown;
}

export class TuyaWebApi implements SharingTokenListener {
  private customerApi?: CustomerApi;
  private deviceCodeMap = new Map<string, DeviceCodeMapping>();
  private tokenFilePath: string;
  private terminalId = "";
  private endpoint = "";

  constructor(
    private userCode: string,
    private storagePath: string,
    private log?: Logger,
  ) {
    this.tokenFilePath = path.join(storagePath, "tuya-sharing-tokens.json");
  }

  updateToken(tokenInfo: CustomerTokenInfo): void {
    this.saveTokens({
      user_code: this.userCode,
      token_info: tokenInfo,
      terminal_id: this.terminalId,
      endpoint: this.endpoint,
    });
  }

  public async getOrRefreshToken(): Promise<void> {
    const saved = this.loadTokens();

    if (saved && saved.user_code === this.userCode) {
      this.log?.info("Found saved Tuya tokens, attempting to use them...");
      this.terminalId = saved.terminal_id;
      this.endpoint = saved.endpoint;

      this.customerApi = new CustomerApi(
        saved.token_info,
        "HA_3y9q4ak7g4ephrvke",
        this.userCode,
        saved.endpoint,
        this,
        this.log,
      );

      try {
        await this.customerApi.refreshAccessTokenIfNeeded();
        this.log?.info("Successfully connected with saved Tuya tokens");
        return;
      } catch (e) {
        this.log?.warn(
          "Saved tokens expired or invalid, starting QR code login: %s",
          e instanceof Error ? e.message : String(e),
        );
      }
    }

    await this.performQrLogin();
  }

  private async performQrLogin(): Promise<void> {
    const loginControl = new LoginControl();
    const { token, qrData } = await loginControl.generateQrCode(
      this.userCode,
      this.log,
    );

    this.log?.info("========================================");
    this.log?.info("  TUYA SMART LIFE PAIRING REQUIRED");
    this.log?.info("========================================");
    this.log?.info(
      "Please scan the QR code below with your Smart Life app:",
    );
    this.log?.info(
      "  1. Open the Smart Life app on your phone",
    );
    this.log?.info(
      "  2. Tap 'Me' → tap your profile → 'Scan QR Code'",
    );
    this.log?.info(
      "  3. Scan the QR code displayed below",
    );
    this.log?.info(
      "  4. Confirm the authorization in the app",
    );
    this.log?.info("----------------------------------------");

    try {
      const qrText = await QRCode.toString(qrData, {
        type: "terminal",
        small: true,
      });
      for (const line of qrText.split("\n")) {
        this.log?.info(line);
      }
    } catch {
      this.log?.info("QR Data: %s", qrData);
    }

    this.log?.info("----------------------------------------");
    this.log?.info("Waiting for you to scan (up to 5 minutes)...");

    const loginResult = await loginControl.waitForLogin(
      token,
      this.userCode,
      this.log,
    );

    this.log?.info(
      "Login successful! Connected as: %s",
      loginResult.username || loginResult.uid,
    );

    this.setupFromLoginResult(loginResult);
  }

  private setupFromLoginResult(result: LoginTokenResponse): void {
    const tokenInfo: CustomerTokenInfo = {
      t: result.t,
      expire_time: result.t + result.expire_time * 1000,
      uid: result.uid,
      access_token: result.access_token,
      refresh_token: result.refresh_token,
    };

    this.terminalId = result.terminal_id;
    this.endpoint = result.endpoint;

    this.customerApi = new CustomerApi(
      tokenInfo,
      "HA_3y9q4ak7g4ephrvke",
      this.userCode,
      result.endpoint,
      this,
      this.log,
    );

    this.saveTokens({
      user_code: this.userCode,
      token_info: tokenInfo,
      terminal_id: result.terminal_id,
      endpoint: result.endpoint,
    });
  }

  // -------------------------------------------------------
  // Device Discovery & Control
  // -------------------------------------------------------

  public async getAllDeviceStates(): Promise<TuyaDevice[] | undefined> {
    return this.discoverDevices();
  }

  public async discoverDevices(): Promise<TuyaDevice[] | undefined> {
    if (!this.customerApi) {
      throw new AuthenticationError("Not authenticated");
    }

    this.log?.debug("Discovering devices via Smart Life API...");

    const homes = await this.queryHomes();
    if (homes.length === 0) {
      this.log?.warn(
        "No homes found. Make sure you have homes set up in your Smart Life app.",
      );
      return [];
    }

    this.log?.info("Found %d home(s)", homes.length);

    const allDevices: TuyaDevice[] = [];
    for (const home of homes) {
      this.log?.debug("Fetching devices for home: %s", home.name);
      const cloudDevices = await this.queryDevicesByHome(home.id);

      for (const cd of cloudDevices) {
        const devType = this.resolveDeviceType(cd.category);
        const statusItems = cd.status ?? [];
        const codeMapping = this.buildCodeMapping(
          cd.category,
          devType,
          statusItems,
        );
        this.deviceCodeMap.set(cd.id, codeMapping);

        const deviceState = this.translateStatusToDeviceState(
          statusItems,
          cd.online,
        );

        allDevices.push({
          id: cd.id,
          name: cd.name,
          dev_type: devType,
          ha_type: DEV_TYPE_TO_HA_TYPE[devType],
          data: deviceState,
        });

        this.log?.debug(
          "Device [%s] category=%s → dev_type=%s (codes: %s)",
          cd.name,
          cd.category,
          devType,
          statusItems.map((s: { code: string }) => s.code).join(", "),
        );
      }
    }

    this.log?.info("Found %d device(s) total", allDevices.length);
    return allDevices;
  }

  public async getDeviceState(deviceId: string): Promise<DeviceState> {
    if (!this.customerApi) {
      throw new AuthenticationError("Not authenticated");
    }

    const response = await this.customerApi.get<CloudDevice[]>(
      "/v1.0/m/life/ha/devices/detail",
      { devIds: deviceId },
    );

    if (!response.success || !response.result?.length) {
      throw new Error(`Failed to get device state for ${deviceId}`);
    }

    const device = response.result[0];
    const statusItems = device.status ?? [];

    if (!this.deviceCodeMap.has(deviceId) && statusItems.length > 0) {
      const devType = this.resolveDeviceType(device.category);
      this.deviceCodeMap.set(
        deviceId,
        this.buildCodeMapping(device.category, devType, statusItems),
      );
    }

    return this.translateStatusToDeviceState(
      statusItems,
      device.online,
    );
  }

  public async setDeviceState<Method extends TuyaApiMethod>(
    deviceId: string,
    method: Method,
    payload: TuyaApiPayload<Method>,
  ): Promise<void> {
    if (!this.customerApi) {
      throw new AuthenticationError("Not authenticated");
    }

    const commands = this.translateMethodToCommands(deviceId, method, payload);

    this.log?.debug(
      "Sending commands to device %s: %s",
      deviceId,
      JSON.stringify(commands),
    );

    try {
      await this.customerApi.post(
        `/v1.1/m/thing/${deviceId}/commands`,
        undefined,
        { commands },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("2009") || msg.includes("UnsupportedOperation")) {
        throw new UnsupportedOperationError("Unsupported operation", msg);
      }
      if (msg.includes("1100") || msg.includes("1101") || msg.includes("FrequentlyInvoke")) {
        throw new RateLimitError("Rate limited", msg);
      }
      if (msg.includes("2013") || msg.includes("TargetOffline")) {
        throw new DeviceOfflineError();
      }
      throw e;
    }
  }

  // -------------------------------------------------------
  // Private: Smart Life API calls
  // -------------------------------------------------------

  private async queryHomes(): Promise<{ id: string; name: string }[]> {
    const response = await this.customerApi!.get<
      { ownerId: string | number; name: string }[]
    >("/v1.0/m/life/users/homes");

    if (!response.success || !Array.isArray(response.result)) {
      return [];
    }

    return response.result.map((h) => ({
      id: String(h.ownerId),
      name: h.name,
    }));
  }

  private async queryDevicesByHome(homeId: string): Promise<CloudDevice[]> {
    const response = await this.customerApi!.get<CloudDevice[]>(
      "/v1.0/m/life/ha/home/devices",
      { homeId },
    );

    if (!response.success || !Array.isArray(response.result)) {
      return [];
    }

    return response.result.map((d) => {
      const status: { code: string; value: unknown }[] = [];
      if (Array.isArray(d.status)) {
        for (const s of d.status) {
          if (
            typeof s === "object" &&
            s !== null &&
            "code" in s &&
            "value" in s
          ) {
            status.push({ code: (s as Record<string, unknown>).code as string, value: (s as Record<string, unknown>).value });
          }
        }
      }
      return { ...d, status };
    });
  }

  // -------------------------------------------------------
  // Private: Translation logic
  // -------------------------------------------------------

  private resolveDeviceType(category: string): TuyaDeviceType {
    return CATEGORY_TO_DEV_TYPE[category] ?? "switch";
  }

  private buildCodeMapping(
    category: string,
    devType: TuyaDeviceType,
    status: { code: string; value: unknown }[],
  ): DeviceCodeMapping {
    const codes = status.map((s) => s.code);
    const mapping: DeviceCodeMapping = {
      category,
      devType,
      switchCode: "switch",
    };

    if (codes.includes("switch_led")) {mapping.switchCode = "switch_led";}
    else if (codes.includes("switch_1")) {mapping.switchCode = "switch_1";}
    else if (codes.includes("switch")) {mapping.switchCode = "switch";}

    if (codes.includes("bright_value_v2"))
      {mapping.brightnessCode = "bright_value_v2";}
    else if (codes.includes("bright_value"))
      {mapping.brightnessCode = "bright_value";}

    if (codes.includes("colour_data_v2"))
      {mapping.colourCode = "colour_data_v2";}
    else if (codes.includes("colour_data"))
      {mapping.colourCode = "colour_data";}

    if (codes.includes("temp_value_v2"))
      {mapping.tempValueCode = "temp_value_v2";}
    else if (codes.includes("temp_value"))
      {mapping.tempValueCode = "temp_value";}

    if (codes.includes("work_mode")) {mapping.workModeCode = "work_mode";}

    if (codes.includes("fan_speed_percent"))
      {mapping.fanSpeedCode = "fan_speed_percent";}
    else if (codes.includes("speed")) {mapping.fanSpeedCode = "speed";}

    if (codes.includes("control")) {mapping.controlCode = "control";}

    return mapping;
  }

  private translateStatusToDeviceState(
    status: { code: string; value: unknown }[],
    online: boolean,
  ): DeviceState {
    const state: DeviceState = { online };

    for (const { code, value } of status) {
      switch (code) {
        case "switch_led":
        case "switch_1":
        case "switch":
          state.state = value as boolean;
          break;

        case "bright_value":
        case "bright_value_v2":
          state.brightness = value as number;
          break;

        case "colour_data":
        case "colour_data_v2": {
          const c: Record<string, number> =
            typeof value === "string"
              ? (JSON.parse(value) as Record<string, number>)
              : (value as Record<string, number>);
          state.color = {
            hue: String(c.h ?? 0),
            saturation: String(Math.round((c.s ?? 0) / 10)),
            brightness: String(c.v ?? 0),
          };
          break;
        }

        case "temp_value":
        case "temp_value_v2":
          state.color_temp = value as number;
          break;

        case "work_mode":
          state.color_mode = value as string as DeviceState["color_mode"];
          break;

        case "fan_speed_percent":
        case "speed":
          state.speed = value as number;
          break;

        case "speed_level":
          state.speed_level = value as number;
          break;

        case "temp_set":
          state.temperature = value as number;
          break;

        case "temp_current":
          state.current_temperature = value as number;
          break;

        case "mode":
          state.mode = value as DeviceState["mode"];
          break;

        case "upper_temp":
          state.max_temper = value as number;
          break;

        case "lower_temp":
          state.min_temper = value as number;
          break;

        case "control":
          if (value === "open") {state.state = CoverState.Opening;}
          else if (value === "close") {state.state = CoverState.Closing;}
          else if (value === "stop") {state.state = CoverState.Stopped;}
          break;

        case "support_stop":
          state.support_stop = value as boolean;
          break;
      }
    }

    return state;
  }

  private translateMethodToCommands(
    deviceId: string,
    method: TuyaApiMethod,
    payload: TuyaApiPayload<TuyaApiMethod>,
  ): { code: string; value: unknown }[] {
    const meta = this.deviceCodeMap.get(deviceId);

    switch (method) {
      case "turnOnOff": {
        const p = payload as TuyaApiPayload<"turnOnOff">;
        const on = p.value === 1;
        if (
          meta?.controlCode &&
          (meta.devType === "cover" || meta.devType === "window")
        ) {
          return [{ code: meta.controlCode, value: on ? "open" : "close" }];
        }
        return [{ code: meta?.switchCode ?? "switch", value: on }];
      }

      case "brightnessSet": {
        const p = payload as TuyaApiPayload<"brightnessSet">;
        return [
          {
            code: meta?.brightnessCode ?? "bright_value_v2",
            value: p.value,
          },
        ];
      }

      case "colorSet": {
        const p = payload as TuyaApiPayload<"colorSet">;
        const colorData = {
          h: p.color.hue,
          s: Math.round(p.color.saturation * 1000),
          v: p.color.brightness,
        };
        const colorCmds: { code: string; value: unknown }[] = [];
        if (meta?.workModeCode) {
          colorCmds.push({ code: meta.workModeCode, value: "colour" });
        }
        colorCmds.push({
          code: meta?.colourCode ?? "colour_data_v2",
          value: JSON.stringify(colorData),
        });
        return colorCmds;
      }

      case "colorTemperatureSet": {
        const p = payload as TuyaApiPayload<"colorTemperatureSet">;
        const tempCmds: { code: string; value: unknown }[] = [];
        if (meta?.workModeCode) {
          tempCmds.push({ code: meta.workModeCode, value: "white" });
        }
        tempCmds.push({
          code: meta?.tempValueCode ?? "temp_value_v2",
          value: p.value,
        });
        return tempCmds;
      }

      case "windSpeedSet": {
        const p = payload as TuyaApiPayload<"windSpeedSet">;
        return [
          {
            code: meta?.fanSpeedCode ?? "fan_speed_percent",
            value: p.value,
          },
        ];
      }

      case "modeSet": {
        const p = payload as TuyaApiPayload<"modeSet">;
        return [{ code: "mode", value: p.value }];
      }

      case "temperatureSet": {
        const p = payload as TuyaApiPayload<"temperatureSet">;
        return [{ code: "temp_set", value: p.value }];
      }

      case "startStop":
        return [{ code: meta?.controlCode ?? "control", value: "stop" }];

      default:
        this.log?.warn("Unknown API method: %s", method);
        return [];
    }
  }

  // -------------------------------------------------------
  // Token persistence
  // -------------------------------------------------------

  private loadTokens(): StoredTokenData | null {
    try {
      if (fs.existsSync(this.tokenFilePath)) {
        const data = fs.readFileSync(this.tokenFilePath, "utf8");
        return JSON.parse(data) as StoredTokenData;
      }
    } catch (e) {
      this.log?.debug(
        "Could not load saved tokens: %s",
        e instanceof Error ? e.message : String(e),
      );
    }
    return null;
  }

  private saveTokens(data: StoredTokenData): void {
    try {
      fs.writeFileSync(this.tokenFilePath, JSON.stringify(data, null, 2));
      this.log?.debug("Tokens saved to %s", this.tokenFilePath);
    } catch (e) {
      this.log?.warn(
        "Could not save tokens: %s",
        e instanceof Error ? e.message : String(e),
      );
    }
  }
}
