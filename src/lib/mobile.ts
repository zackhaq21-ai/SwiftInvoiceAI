/**
 * Mobile platform helpers. When Capacitor packages are installed, these use
 * the native plugins. On web (or when Capacitor is not installed), they fall
 * back to standard browser APIs so the app still works in the dev server.
 */

export function isNativePlatform(): boolean {
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return cap?.isNativePlatform?.() ?? false;
  } catch {
    return false;
  }
}

export function getPlatform(): 'ios' | 'android' | 'web' {
  try {
    const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
    const p = cap?.getPlatform?.();
    if (p === 'ios' || p === 'android') return p;
  } catch { /* not native */ }
  return 'web';
}

export async function openExternalUrl(url: string): Promise<void> {
  if (isNativePlatform()) {
    try {
      // @ts-expect-error - @capacitor/browser is an optional native-only dependency
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url, windowName: '_self' });
      return;
    } catch { /* browser plugin not available */ }
  }
  window.location.href = url;
}

export async function getWebBaseUrl(): Promise<string> {
  if (!isNativePlatform()) {
    return window.location.origin;
  }
  try {
    // @ts-expect-error - @capacitor/preferences is an optional native-only dependency
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key: 'webBaseUrl' });
    if (value) return value;
  } catch { /* preferences plugin not available */ }
  const envUrl = import.meta.env.VITE_APP_URL as string | undefined;
  if (envUrl) return envUrl;
  return 'https://thatinvoice.app';
}

export async function setWebBaseUrl(url: string): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    // @ts-expect-error - @capacitor/preferences is an optional native-only dependency
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key: 'webBaseUrl', value: url });
  } catch { /* preferences plugin not available */ }
}

export async function buildReturnUrl(path: string): Promise<string> {
  const base = await getWebBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
