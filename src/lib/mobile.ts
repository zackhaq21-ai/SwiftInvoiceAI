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

// Bundlers (Vite/Rollup/webpack) statically resolve a dynamic import()'s
// specifier whenever it's a literal string, even inside a try/catch —
// which breaks the build the moment an optional native-only package isn't
// installed. Routing the specifier through a variable makes it genuinely
// non-analyzable, so it's only ever resolved at real runtime (i.e. never,
// on web, since these branches only run once isNativePlatform() is true).
const CAPACITOR_BROWSER_PKG = '@capacitor/browser';
const CAPACITOR_PREFERENCES_PKG = '@capacitor/preferences';
const CAPACITOR_CONTACTS_PKG = '@capacitor-community/contacts';

export async function openExternalUrl(url: string): Promise<void> {
  if (isNativePlatform()) {
    try {
      const { Browser } = await import(/* @vite-ignore */ CAPACITOR_BROWSER_PKG);
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
    const { Preferences } = await import(/* @vite-ignore */ CAPACITOR_PREFERENCES_PKG);
    const { value } = await Preferences.get({ key: 'webBaseUrl' });
    if (value) return value;
  } catch { /* preferences plugin not available */ }
  const envUrl = import.meta.env.VITE_APP_URL as string | undefined;
  if (envUrl) return envUrl;
  // Last resort: never fabricate a production domain. On native this is only
  // reached if VITE_APP_URL wasn't set at build time — falling back to the
  // native webview's own origin is always valid, even if not ideal.
  return window.location.origin;
}

export async function setWebBaseUrl(url: string): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    const { Preferences } = await import(/* @vite-ignore */ CAPACITOR_PREFERENCES_PKG);
    await Preferences.set({ key: 'webBaseUrl', value: url });
  } catch { /* preferences plugin not available */ }
}

export async function buildReturnUrl(path: string): Promise<string> {
  const base = await getWebBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

export interface PickedContact {
  name: string;
  email: string | null;
  phone: string | null;
}

interface WebContact {
  name?: string[];
  email?: string[];
  tel?: string[];
}

interface ContactsManager {
  select(properties: string[], options?: { multiple?: boolean }): Promise<WebContact[]>;
}

/**
 * Whether a contact picker is available on this device right now — either
 * the native plugin (once installed) or the browser's Contact Picker API
 * (supported on Chrome for Android; unsupported browsers simply hide the
 * "Import from contacts" option rather than showing a dead button).
 */
export function hasContactPicker(): boolean {
  if (isNativePlatform()) return true; // native plugin loaded lazily on demand, see pickContact()
  return typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;
}

/**
 * Opens the device's native contact picker and returns the single contact
 * the user chose, or null if they cancelled or no picker is available.
 * Never throws — a picker failure just means the caller falls back to
 * manual entry, exactly like every other helper in this file.
 */
export async function pickContact(): Promise<PickedContact | null> {
  if (isNativePlatform()) {
    try {
      const { Contacts } = await import(/* @vite-ignore */ CAPACITOR_CONTACTS_PKG);
      const { contacts } = await Contacts.pickContact({
        projection: { name: true, phones: true, emails: true },
      });
      const picked = contacts?.[0];
      if (!picked) return null;
      return {
        name: picked.name?.display || [picked.name?.given, picked.name?.family].filter(Boolean).join(' ') || '',
        email: picked.emails?.[0]?.address || null,
        phone: picked.phones?.[0]?.number || null,
      };
    } catch {
      return null; // native plugin not installed yet — caller falls back to manual entry
    }
  }

  try {
    const manager = (navigator as unknown as { contacts?: ContactsManager }).contacts;
    if (!manager || !('ContactsManager' in window)) return null;
    const [picked] = await manager.select(['name', 'email', 'tel'], { multiple: false });
    if (!picked) return null;
    return {
      name: picked.name?.[0] || '',
      email: picked.email?.[0] || null,
      phone: picked.tel?.[0] || null,
    };
  } catch {
    return null; // user cancelled the picker, or the browser refused (e.g. no user gesture)
  }
}
