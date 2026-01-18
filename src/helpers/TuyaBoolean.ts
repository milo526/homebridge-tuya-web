import type { ExtendedBoolean } from "../api/response";

/**
 * Convert Tuya's various boolean representations to a standard boolean.
 * Tuya APIs can return: true, false, "true", "false", 1, 0, "1", "0"
 */
export const TuyaBoolean = (value: ExtendedBoolean | undefined): boolean => {
  if (value === undefined || value === null) {
    return false;
  }
  
  // Handle direct booleans
  if (typeof value === 'boolean') {
    return value;
  }
  
  // Handle numbers
  if (typeof value === 'number') {
    return value === 1;
  }
  
  // Handle strings
  const strValue = String(value).toLowerCase();
  return strValue === 'true' || strValue === '1';
};
