/**
 * Mistral-backed Define, Translate, and Ask AI via Supabase Edge Function.
 * Uses app-wide monthly cap; no user API keys required.
 * Definitions are cached locally so repeat lookups don't call the API.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {supabase, supabaseUrl} from './supabase';
import type {EnhancedDefinition} from './dictionaryService';

const DEFINE_CACHE_PREFIX = '@mistral_define_';
const DEFINE_CACHE_VERSION = 'v2_';
const DEFINE_CACHE_DAYS = 30;

export interface MistralDefineResponse {
  definition: string;
  word: string;
  spanishWord?: string;
  spanishTranslation?: string;
  englishConjugation?: string;
  conjugation?: string;
  synonyms?: string[];
}

export interface MistralTranslateResponse {
  translatedText: string;
  sourceLang: 'en' | 'es';
  targetLang: 'en' | 'es';
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

async function getCachedDefinition(word: string): Promise<EnhancedDefinition | null> {
  try {
    const key = `${DEFINE_CACHE_PREFIX}${DEFINE_CACHE_VERSION}${word.toLowerCase()}`;
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

async function setCachedDefinition(word: string, data: EnhancedDefinition): Promise<void> {
  try {
    const key = `${DEFINE_CACHE_PREFIX}${DEFINE_CACHE_VERSION}${word.toLowerCase()}`;
    await AsyncStorage.setItem(key, JSON.stringify({data, timestamp: Date.now()}));
  } catch {
    // ignore
  }
}

export const mistralService = {
  /**
   * Get definition for a word/phrase (Mistral). Returns a minimal EnhancedDefinition for UI/cards.
   * Uses local cache so the same word does not call the API again within the cache window.
   */
  async getDefinition(text: string): Promise<EnhancedDefinition | null> {
    const trimmed = text.trim();
    const cached = await getCachedDefinition(trimmed);
    // Use cache only if it has dictionary-style data (Spanish word + definition)
    if (cached && cached.spanishTranslation && cached.spanishWord) return cached;

    const res = await invoke<MistralDefineResponse>({
      action: 'define',
      text: trimmed,
    });
    if (!res?.definition) return null;
    const result: EnhancedDefinition = {
      word: res.word || trimmed,
      language: 'en',
      definition: res.definition,
      spanishWord: res.spanishWord,
      spanishTranslation: res.spanishTranslation,
      englishConjugation: res.englishConjugation,
      conjugation: res.conjugation,
      synonyms: res.synonyms?.slice(0, 3),
    };
    await setCachedDefinition(trimmed, result);
    return result;
  },

  /**
   * Translate text between English and Spanish (Mistral).
   */
  async translate(
    text: string,
    sourceLang: 'en' | 'es',
    targetLang: 'en' | 'es'
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
   * Ask a grammar/language question about the given text (Mistral).
   */
  async askGrammar(text: string, question: string): Promise<MistralAskResponse | null> {
    const res = await invoke<MistralAskResponse>({
      action: 'ask',
      text: text.trim(),
      question: question.trim() || 'Explain the grammar or language of this text.',
    });
    return res ?? null;
  },
};
