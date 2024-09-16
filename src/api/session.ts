export class Session {
  static isValidSessionData(data: Record<string, unknown>): data is {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  } {
    return (
      typeof data.access_token === "string" &&
      typeof data.refresh_token === "string" &&
      typeof data.expires_in === "number"
    );
  }

  private _areaBaseUrl!: string;
  private expiresOn!: number;

  constructor(
    private _accessToken: string,
    private _refreshToken: string,
    private expiresIn: number,
    private _areaCode: string,
  ) {
    this.areaCode = _areaCode;
    this.resetToken(_accessToken, _refreshToken, expiresIn);
  }

  public get accessToken(): string {
    return this._accessToken;
  }

  public get areaBaseUrl(): string {
    return this._areaBaseUrl;
  }

  public get refreshToken(): string {
    return this._refreshToken;
  }

  public set areaCode(newAreaCode: string) {
    const areaCodeLookup = {
      AY: "https://px1.tuyacn.com",
      EU: "https://px1.tuyaeu.com",
      US: "https://px1.tuyaus.com",
    };

    this._areaCode = newAreaCode;
    this._areaBaseUrl =
      newAreaCode in areaCodeLookup
        ? areaCodeLookup[newAreaCode as keyof typeof areaCodeLookup]
        : areaCodeLookup.US;
  }

  public resetToken(
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
  ): void {
    this._accessToken = accessToken;
    this._refreshToken = refreshToken;
    this.expiresOn = Session.getCurrentEpoch() + expiresIn;
  }

  public hasToken(): boolean {
    return !!this._accessToken;
  }

  public isTokenExpired(): boolean {
    return this.expiresOn < Session.getCurrentEpoch();
  }

  public hasValidToken(): boolean {
    return this.hasToken() && !this.isTokenExpired();
  }

  private static getCurrentEpoch(): number {
    return Math.round(new Date().getTime() / 1000);
  }
}
