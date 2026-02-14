import axios from 'axios';
import {apiKeyService} from './apiKeyService';

/**
 * Translation using the user's own MyMemory API key (add in Settings).
 * Works without a key at lower limits. Get a free key at https://mymemory.translated.net/doc/keygen.php
 */

const MYMEMORY_API = 'https://api.mymemory.translated.net/get';

export interface Translation {
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  originalText: string;
}

export const translationService = {
  async translate(
    text: string,
    sourceLang: 'en' | 'es',
    targetLang: 'en' | 'es'
  ): Promise<Translation | null> {
    const apiKey = await apiKeyService.getLibreTranslateKey();
    const params: Record<string, string> = {
      q: text,
      langpair: `${sourceLang}|${targetLang}`,
    };
    if (apiKey) params.key = apiKey;

    console.log(`🌐 Translating: ${sourceLang} → ${targetLang}`);

    const response = await axios.get(MYMEMORY_API, {params, timeout: 10000});

    if (response.data?.responseData?.translatedText) {
      const translatedText = response.data.responseData.translatedText;
      if (translatedText === text || response.data.responseStatus === 403) {
        throw new Error(
          'Translation limit reached. Add a free MyMemory API key in Settings to increase your daily limit (get one at mymemory.translated.net).'
        );
      }
      return {
        translatedText,
        sourceLang,
        targetLang,
        originalText: text,
      };
    }

    return null;
  },

  async autoTranslate(text: string): Promise<Translation | null> {
    const maxLength = 500;
    const textToTranslate =
      text.length > maxLength ? text.substring(0, maxLength) + '...' : text;

    const spanishIndicators = [
      'el', 'la', 'los', 'las', 'de', 'que', 'es', 'un', 'una', 'por', 'para', 'con', 'del',
    ];
    const wordsLower = textToTranslate.toLowerCase().split(/\s+/);
    const spanishWordCount = wordsLower.filter((w) =>
      spanishIndicators.includes(w)
    ).length;
    const isLikelySpanish = spanishWordCount >= 2;

    if (isLikelySpanish) {
      return await this.translate(textToTranslate, 'es', 'en');
    }
    return await this.translate(textToTranslate, 'en', 'es');
  },

  formatTranslation(translation: Translation): string {
    const langNames: Record<string, string> = {
      en: 'English',
      es: 'Spanish',
      auto: 'Auto',
    };
    return `${langNames[translation.sourceLang] || translation.sourceLang} → ${langNames[translation.targetLang]}\n\nTranslation: ${translation.translatedText}`;
  },
};
