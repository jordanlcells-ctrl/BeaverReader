/**
 * Translation result formatting. Actual translation is done via Mistral (Supabase Edge Function).
 */
import {getLangMeta} from './readingPreferencesService';
import type {LanguageCode} from './readingPreferencesService';

export interface Translation {
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  originalText: string;
}

export const translationService = {
  formatTranslation(translation: Translation): string {
    const meta = getLangMeta(translation.targetLang as LanguageCode);
    return `${meta.flag} ${meta.name}:\n${translation.translatedText}`;
  },
};
