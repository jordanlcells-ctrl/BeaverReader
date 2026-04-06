/**
 * Mistral-backed Define, Translate, and Ask AI via Supabase Edge Function.
 * Uses app-wide monthly cap; no user API keys required.
 * Definitions are cached locally so repeat lookups don't call the API.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {supabase, supabaseUrl} from './supabase';
import {
  nativeDefinitionLooksLikeEnglish,
  normalizeMistralEnhancedDef,
  shouldTranslateDefinitionToNative,
  stripDefinitionForLangHeuristic,
  type EnhancedDefinition,
} from './dictionaryService';

const NATIVE_LANG_NAME: Record<string, string> = {
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  pl: 'Polish',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  ru: 'Russian',
};

const DEFINE_CACHE_PREFIX = '@mistral_define_';
/** Bump when define payload semantics change (e.g. synonym language). */
const DEFINE_CACHE_VERSION = 'v13_';
const DEFINE_CACHE_DAYS = 30;

export interface MistralDefineResponse {
  definition: string;
  word: string;
  nativeWord?: string;
  targetWord?: string;
  targetDefinition?: string;
  conjugation?: string;
  nativeConjugation?: string;
  synonyms?: string[];
}

export interface MistralTranslateResponse {
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  originalText: string;
}

export interface MistralAskResponse {
  answer: string;
  question: string;
}

async function invoke<T>(body: object): Promise<T> {
  const {data: {session: initialSession}} = await supabase.auth.getSession();
  if (!initialSession?.access_token) {
    throw new Error('Please sign in to use this feature.');
  }

  // Refresh session so the JWT is valid (avoids "Invalid JWT" from expired token)
  const {data: {session}} = await supabase.auth.refreshSession();
  const token = session?.access_token ?? initialSession?.access_token;
  if (!token) {
    throw new Error('Please sign in again to use this feature.');
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/mistral`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      (typeof data?.error === 'string' ? data.error : data?.error?.message) ||
      data?.message ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }

  if (data?.error) {
    const msg = typeof data.error === 'string' ? data.error : data.error.message ?? 'Request failed';
    throw new Error(msg);
  }

  return data as T;
}

async function getCachedDefinition(word: string, nativeLang: string, targetLang: string): Promise<EnhancedDefinition | null> {
  try {
    const key = `${DEFINE_CACHE_PREFIX}${DEFINE_CACHE_VERSION}${word.toLowerCase()}_${nativeLang}_${targetLang}`;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const {data, timestamp} = JSON.parse(raw);
    const maxAge = DEFINE_CACHE_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - timestamp > maxAge) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    return {...data, cached: true};
  } catch {
    return null;
  }
}

async function setCachedDefinition(word: string, nativeLang: string, targetLang: string, data: EnhancedDefinition): Promise<void> {
  try {
    const key = `${DEFINE_CACHE_PREFIX}${DEFINE_CACHE_VERSION}${word.toLowerCase()}_${nativeLang}_${targetLang}`;
    await AsyncStorage.setItem(key, JSON.stringify({data, timestamp: Date.now()}));
  } catch {
    // ignore
  }
}

function stripTranslationNoise(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').trim();
  s = s.replace(/^["'„«]|["'”»]$/g, '').trim();
  s = s.replace(
    /^(translation|tłumaczenie|here\s+is|here'?s|in polish|polish|polski|w języku polskim|output|result)\s*[:\-–]\s*/i,
    '',
  ).trim();
  const lines = s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), '');
    if (longest.length >= s.length * 0.5) s = longest;
  }
  return s.trim();
}

function translationLooksLikeAcceptableNative(nativeLang: string, text: string): boolean {
  const s = stripTranslationNoise(text);
  if (!s) return false;
  if (nativeLang === 'pl') {
    if (/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(s)) return true;
    if (
      /\b(jest|są|być|nie|się|że|lub|albo|dla|przez|który|która|które|gdy|kiedy|tylko|bardzo|może|woda|wody|powodzi|ilość|duża|duże|mała|obszar|suchy|sucha|mokre|znaczy|oznacza|ubiór|osób|miejsce|zwykle|często|znaczy)\b/i.test(
        s,
      )
    ) {
      return true;
    }
  }
  if (nativeLang === 'es') {
    if (/[áéíóúñü¿¡]/.test(s)) return true;
    if (/\b(el|la|los|las|un|una|es|son|para|que|con|por|como|significa)\b/i.test(s)) return true;
  }
  if (nativeLang === 'fr' && /[àâäéèêëïîôùûüÿçœæ]/i.test(s)) return true;
  if (nativeLang === 'de' && /[äöüßÄÖÜ]/.test(s)) return true;
  return false;
}

function acceptTranslatedNativeDefinition(nativeLang: string, translated: string): boolean {
  const s = stripTranslationNoise(translated);
  if (!s) return false;
  if (translationLooksLikeAcceptableNative(nativeLang, s)) return true;
  return !nativeDefinitionLooksLikeEnglish(nativeLang, s);
}

/** Si `definition` llegó en inglés pero el nativo no es inglés, traducir en→nativo (cubre pl, fr, es, etc.). */
async function ensureNativeDefinitionLanguage(
  def: EnhancedDefinition,
  nativeLang: string,
  targetLang: string,
): Promise<EnhancedDefinition> {
  if (nativeLang === 'en') return def;
  const full = def.definition?.trim() ?? '';
  if (!full || !shouldTranslateDefinitionToNative(nativeLang, targetLang, full)) return def;
  const toTranslate = stripDefinitionForLangHeuristic(full) || full;
  if (!toTranslate) return def;

  const parseTranslated = (tr: MistralTranslateResponse | Record<string, unknown> | null | undefined) => {
    const o = tr as Record<string, unknown> | null | undefined;
    const a =
      (typeof o?.translatedText === 'string' && o.translatedText) ||
      (typeof o?.translated_text === 'string' && o.translated_text) ||
      '';
    return stripTranslationNoise(a) || undefined;
  };

  const runTranslate = (text: string) =>
    invoke<MistralTranslateResponse>({
      action: 'translate',
      text,
      sourceLang: 'en',
      targetLang: nativeLang,
      glossMode: true,
    });

  const langLabel = NATIVE_LANG_NAME[nativeLang] ?? nativeLang;
  const prompts = [
    toTranslate,
    `[${langLabel} only — same meaning, output no English:]\n${toTranslate}`,
  ];
  if (nativeLang === 'pl') {
    prompts.push(`Odpowiedz wyłącznie po polsku (1–2 zdania). Tłumaczenie:\n\n${toTranslate}`);
  }

  let translated: string | undefined;
  for (let attempt = 0; attempt < prompts.length; attempt++) {
    try {
      const raw = await runTranslate(prompts[attempt]!);
      translated = parseTranslated(raw);
    } catch {
      translated = undefined;
    }
    if (translated && acceptTranslatedNativeDefinition(nativeLang, translated)) {
      return normalizeMistralEnhancedDef({...def, definition: translated}, nativeLang, targetLang);
    }
  }

  if (translated && !nativeDefinitionLooksLikeEnglish(nativeLang, translated)) {
    return normalizeMistralEnhancedDef({...def, definition: translated}, nativeLang, targetLang);
  }

  return def;
}

/** Gloss en idioma objetivo vacío, o solo repite el lema (p. ej. "crowds" sin frase). */
function targetGlossNeedsFill(def: EnhancedDefinition): boolean {
  const td = def.targetDefinition?.trim();
  if (!td) return true;
  const tw = def.targetWord?.trim().toLowerCase();
  if (!tw) return false;
  if (td.toLowerCase() === tw) return true;
  return false;
}

/** Si el modelo no devolvió gloss en idioma objetivo, traducir la definición nativa (p. ej. PL → EN). */
async function ensureTargetGlossIfMissing(
  def: EnhancedDefinition,
  nativeLang: string,
  targetLang: string,
): Promise<EnhancedDefinition> {
  if (!targetGlossNeedsFill(def)) return def;
  const nativeDef = def.definition?.trim();
  if (!nativeDef) return def;
  if (nativeLang === targetLang) return def;
  try {
    const tr = await invoke<MistralTranslateResponse>({
      action: 'translate',
      text: nativeDef,
      sourceLang: nativeLang,
      targetLang: targetLang,
    });
    const o = tr as Record<string, unknown>;
    const raw =
      (typeof o?.translatedText === 'string' && o.translatedText) ||
      (typeof o?.translated_text === 'string' && o.translated_text) ||
      '';
    const gloss = stripTranslationNoise(raw);
    if (!gloss) return def;
    return normalizeMistralEnhancedDef({...def, targetDefinition: gloss}, nativeLang, targetLang);
  } catch {
    return def;
  }
}

/** Si no hay target_word pero la búsqueda es una sola palabra en el idioma objetivo, usarla como lema. */
function ensureTargetWordFromLookup(
  def: EnhancedDefinition,
  lookupTrimmed: string,
  targetLang: string,
): EnhancedDefinition {
  if (def.targetWord?.trim()) return def;
  const w = lookupTrimmed.trim();
  if (!w || /\s/.test(w)) return def;
  if (targetLang === 'en' && /^[a-zA-Z][a-zA-Z\-']*$/i.test(w)) {
    return {...def, targetWord: w};
  }
  if (targetLang === 'es' && /^[a-zA-ZáéíóúñüÁÉÍÓÚÑÜ\-']+$/i.test(w)) {
    return {...def, targetWord: w};
  }
  return def;
}

/** "población — …" : traduce el lema del idioma objetivo al nativo (p. ej. population → población). */
async function ensureNativeHeadword(
  def: EnhancedDefinition,
  lookupTrimmed: string,
  nativeLang: string,
  targetLang: string,
): Promise<EnhancedDefinition> {
  if (def.nativeHeadword?.trim()) return def;
  if (nativeLang === targetLang) return def;
  const lemma = def.targetWord?.trim() || lookupTrimmed.trim();
  if (!lemma) return def;
  try {
    const tr = await invoke<MistralTranslateResponse>({
      action: 'translate',
      text: lemma,
      sourceLang: targetLang,
      targetLang: nativeLang,
    });
    let hw = tr?.translatedText?.trim();
    if (!hw) return def;
    hw = hw.split('\n')[0].trim().replace(/^["'«»]|["'«»]$/g, '');
    if (!hw) return def;
    return normalizeMistralEnhancedDef({...def, nativeHeadword: hw}, nativeLang, targetLang);
  } catch {
    return def;
  }
}

export interface MistralTOCItem {
  title: string;
  page: number;
}

export const mistralService = {
  /**
   * Get definition for a word/phrase (Mistral). Returns a minimal EnhancedDefinition for UI/cards.
   * Uses local cache so the same word does not call the API again within the cache window.
   */
  async getDefinition(text: string, nativeLang = 'en', targetLang = 'es'): Promise<EnhancedDefinition | null> {
    const trimmed = text.trim();
    const cached = await getCachedDefinition(trimmed, nativeLang, targetLang);
    if (cached) {
      return {...normalizeMistralEnhancedDef(cached, nativeLang, targetLang), cached: true};
    }

    const res = await invoke<MistralDefineResponse>({
      action: 'define',
      text: trimmed,
      nativeLang,
      targetLang,
    });
    if (!res?.definition) return null;
    const cleanDef = res.definition
      .replace(/^the meaning in \w+:?\s*/i, '')
      .replace(/^meaning in \w+:?\s*/i, '')
      .trim();
    const raw: EnhancedDefinition = {
      word: res.word || trimmed,
      language: targetLang,
      definition: cleanDef,
      nativeHeadword: res.nativeWord,
      targetWord: res.targetWord,
      targetDefinition: res.targetDefinition,
      conjugation: res.conjugation,
      nativeConjugation: res.nativeConjugation,
      synonyms: res.synonyms?.slice(0, 3),
    };
    let result = normalizeMistralEnhancedDef(raw, nativeLang, targetLang);
    result = ensureTargetWordFromLookup(result, trimmed, targetLang);
    if (!result.nativeHeadword?.trim()) {
      result = await ensureNativeHeadword(result, trimmed, nativeLang, targetLang);
    }
    await setCachedDefinition(trimmed, nativeLang, targetLang, result);
    return result;
  },

  /**
   * Translate text between English and Spanish (Mistral).
   */
  async translate(
    text: string,
    sourceLang: string,
    targetLang: string,
  ): Promise<MistralTranslateResponse | null> {
    const res = await invoke<MistralTranslateResponse>({
      action: 'translate',
      text: text.trim(),
      sourceLang,
      targetLang,
    });
    return res ?? null;
  },

  /**
   * Extract table of contents from raw early-pages PDF text (one-time per book).
   * Returns an array of {title, page} items, or null on failure.
   */
  async extractTOC(text: string, totalPages: number): Promise<MistralTOCItem[] | null> {
    try {
      const res = await invoke<{toc: MistralTOCItem[]}>({
        action: 'toc',
        text: text.trim(),
        totalPages,
      });
      return Array.isArray(res?.toc) ? res.toc : null;
    } catch {
      return null;
    }
  },

  /**
   * Ask a grammar/language question about the given text (Mistral).
   */
  async askGrammar(text: string, question: string, nativeLang = 'en'): Promise<MistralAskResponse | null> {
    const res = await invoke<MistralAskResponse>({
      action: 'ask',
      text: text.trim(),
      question: question.trim() || 'Explain the grammar or language of this text.',
      nativeLang,
    });
    return res ?? null;
  },
};
