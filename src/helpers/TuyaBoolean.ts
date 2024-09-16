import { ExtendedBoolean } from "../api/response";

export const TuyaBoolean = (value: ExtendedBoolean | undefined): boolean => {
  return String(value).toLowerCase() === "true";
};
