const cache = new Map();
const MAX_CACHE = 2000;

const LANG_MAP = {
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  en: 'en',
  ja: 'ja',
  ko: 'ko',
  es: 'es',
  fr: 'fr',
  de: 'de',
  ru: 'ru',
  ar: 'ar',
};

export function normalizeLang(code) {
  return LANG_MAP[code] || code;
}

export async function translateText(text, targetLang, sourceLang = 'auto') {
  const trimmed = (text || '').trim();
  if (!trimmed) return trimmed;

  const target = normalizeLang(targetLang);
  const source = sourceLang === 'auto' ? 'auto' : normalizeLang(sourceLang);
  const cacheKey = `${source}|${target}|${trimmed}`;

  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const langpair =
    source === 'auto' ? `autodetect|${target}` : `${source}|${target}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=${encodeURIComponent(langpair)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('翻译服务暂不可用');
  const data = await res.json();

  if (data.responseStatus && data.responseStatus !== 200) {
    throw new Error(data.responseDetails || '翻译失败');
  }

  const translated = data.responseData?.translatedText?.trim() || trimmed;

  if (cache.size >= MAX_CACHE) {
    const first = cache.keys().next().value;
    cache.delete(first);
  }
  cache.set(cacheKey, translated);
  return translated;
}

export async function translateBatch(items, targetLang) {
  const results = {};
  for (const { id, text } of items) {
    try {
      results[id] = await translateText(text, targetLang);
    } catch {
      results[id] = text;
    }
  }
  return results;
}
