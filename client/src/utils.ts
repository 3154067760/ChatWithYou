import type { UiLocale } from './i18n';

const VISITOR_ID_KEY = 'chatwithyou_visitor_id';
const VISITOR_NAME_KEY = 'chatwithyou_visitor_name';
const LANG_KEY = 'chatwithyou_lang';
const AUTO_TRANSLATE_KEY = 'chatwithyou_auto_translate';
const UI_LOCALE_KEY = 'chatwithyou_ui_locale';

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      /* HTTP 非 localhost 时 randomUUID 可能不可用 */
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 隐私模式等场景忽略 */
  }
}

export function getOrCreateVisitorId(): string {
  let id = safeGetItem(VISITOR_ID_KEY);
  if (!id) {
    id = createId();
    safeSetItem(VISITOR_ID_KEY, id);
  }
  return id;
}

export function getStoredVisitorName(): string {
  return safeGetItem(VISITOR_NAME_KEY) || '';
}

export function setStoredVisitorName(name: string) {
  safeSetItem(VISITOR_NAME_KEY, name);
}

export function getStoredLanguage(): string {
  return safeGetItem(LANG_KEY) || 'zh-CN';
}

export function setStoredLanguage(lang: string) {
  safeSetItem(LANG_KEY, lang);
}

export function getStoredAutoTranslate(): boolean {
  const v = safeGetItem(AUTO_TRANSLATE_KEY);
  return v === null ? true : v === '1';
}

export function setStoredAutoTranslate(on: boolean) {
  safeSetItem(AUTO_TRANSLATE_KEY, on ? '1' : '0');
}

export function getStoredUiLocale(): UiLocale {
  const v = safeGetItem(UI_LOCALE_KEY);
  return v === 'en' ? 'en' : 'zh';
}

export function setStoredUiLocale(locale: UiLocale) {
  safeSetItem(UI_LOCALE_KEY, locale);
}

export function formatFileSize(bytes?: number): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatTime(iso: string, locale: UiLocale = 'zh'): string {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function downloadExport(roomId: string, format: 'json' | 'txt') {
  const res = await fetch(`/api/rooms/${roomId}/export?format=${format}`);
  if (!res.ok) throw new Error('导出失败');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chat-${roomId}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}
