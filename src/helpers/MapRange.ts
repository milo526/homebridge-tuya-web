export class MapRange {
  private constructor(
    public readonly tuyaStart: number,
    public readonly tuyaEnd: number,
    public readonly homekitStart: number,
    public readonly homekitEnd: number,
  ) {}

  static tuya(
    start: number,
    end: number,
  ): { homeKit: (start: number, end: number) => MapRange } {
    return {
      homeKit: (toStart, toEnd) => {
        return new MapRange(start, end, toStart, toEnd);
      },
    };
  }

  public tuyaToHomekit(tuyaValue: number): number {
    return (
      ((tuyaValue - this.tuyaStart) * (this.homekitEnd - this.homekitStart)) /
        (this.tuyaEnd - this.tuyaStart) +
      this.homekitStart
    );
  }

  public homekitToTuya(homeKitValue: number): number {
    return (
      ((homeKitValue - this.homekitStart) * (this.tuyaEnd - this.tuyaStart)) /
        (this.homekitEnd - this.homekitStart) +
      this.tuyaStart
    );
  }
}
