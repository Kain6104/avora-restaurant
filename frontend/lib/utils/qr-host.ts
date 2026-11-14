/**
 * Utility to manage Base URL for Table QR Code generation
 * Allows overriding localhost:4000 with a custom LAN IP (e.g. 192.168.1.15:4000)
 * or public domain so that mobile phones connected to the same WiFi can scan and open the menu.
 */

const STORAGE_KEY = 'avora_pos_qr_custom_host';

export function getCustomQrHost(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEY) || '';
}

export function setCustomQrHost(host: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = host.trim();
  if (trimmed) {
    localStorage.setItem(STORAGE_KEY, trimmed);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function resolveQrBaseUrl(customHost?: string): string {
  if (typeof window === 'undefined') return '';
  const host = (customHost !== undefined ? customHost : getCustomQrHost()).trim();
  if (host) {
    if (host.startsWith('http://') || host.startsWith('https://')) {
      return host.replace(/\/+$/, '');
    }
    return `http://${host}`.replace(/\/+$/, '');
  }
  return window.location.origin;
}
