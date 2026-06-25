declare const __APP_BUILD_DATE__: string;

export const APP_VERSION = "1.3.0";
// Automaticky nastaveno při buildu (viz vite.config.ts → define).
export const LAST_UPDATE_DATE: string =
  typeof __APP_BUILD_DATE__ !== "undefined" ? __APP_BUILD_DATE__ : "—";
