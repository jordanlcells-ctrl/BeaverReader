/**
 * Translation result formatting. Actual translation is done via Mistral (Supabase Edge Function).
 */
export interface Translation {
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  originalText: string;
}

export const translationService = {
  formatTranslation(translation: Translation): string {
    const targetFlag = translation.targetLang === 'es' ? '🇨🇴' : '🇨🇦';
    const targetName = translation.targetLang === 'es' ? 'Spanish' : 'English';
    return `${targetFlag} ${targetName}:\n${translation.translatedText}`;
  },
};
