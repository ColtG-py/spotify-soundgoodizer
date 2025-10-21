/**
 * Additional Chrome Extension type definitions
 * Supplements @types/chrome package with custom types
 */

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

export interface AudioSettings {
  pitch: number;
  speed: number;
}

export interface MessageRequest {
  action: string;
  value?: number;
  event?: string;
  data?: any;
}

export interface MessageResponse {
  success: boolean;
  error?: string;
  settings?: AudioSettings;
  hasSpotifyTab?: boolean;
  tabs?: Array<{ id?: number; url?: string }>;
}

export {};