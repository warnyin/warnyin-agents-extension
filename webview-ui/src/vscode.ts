import type { VsCodeApi } from './types';

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
    __WARNYIN_LOGO_URI__?: string;
  }
}

const fallbackApi: VsCodeApi = {
  postMessage(message: unknown) {
    console.log('[Warnyin Agents]', message);
  },
  getState() {
    return undefined;
  },
  setState() {
    return undefined;
  },
};

export const vscode = window.acquireVsCodeApi ? window.acquireVsCodeApi() : fallbackApi;
export const logoUri = window.__WARNYIN_LOGO_URI__;
