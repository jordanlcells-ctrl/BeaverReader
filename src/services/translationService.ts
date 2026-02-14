import axios from 'axios';
import {apiKeyService} from './apiKeyService';

/**
 * Translation service using MyMemory Translation API
 * Free tier: 1,000 words/day (no key), 10,000 words/day (with free key)
 * Get free API key at: https://mymemory.translated.net/doc/keygen.php
 * No credit card required!
 */

const MYMEMORY_API = 'https://api.mymemory.translated.net/get';

export interface Translation {
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  originalText: string;
}

export const translationService = {
  /**
   * Translate text between English and Spanish using MyMemory API
   */
  async translate(
    text: string,
    sourceLang: 'en' | 'es',
    targetLang: 'en' | 'es'
  ): Promise<Translation | null> {
    try {
      // Get API key (optional - works without it, but with lower limits)
      const apiKey = await apiKeyService.getLibreTranslateKey();
      
      console.log(`🌐 Translating: ${sourceLang} → ${targetLang}`);
      console.log('📝 Text:', text.substring(0, 50) + '...');
      
      // MyMemory requires explicit language pair format like 'en|es'
      const langPair = `${sourceLang}|${targetLang}`;
      
      // Build URL with parameters
      const params: any = {
        q: text,
        langpair: langPair,
      };
      
      // Add API key if available (increases daily limit from 1k to 10k words)
      if (apiKey) {
        params.key = apiKey;
      }
      
      const response = await axios.get(MYMEMORY_API, {
        params,
        timeout: 10000, // 10 second timeout
      });

      if (response.data && response.data.responseData) {
        const translatedText = response.data.responseData.translatedText;
        
        // Check if translation failed
        if (translatedText === text || response.data.responseStatus === 403) {
          throw new Error('Translation limit reached. Add a free API key in Settings to increase your daily limit from 1,000 to 10,000 words.');
        }
        
        console.log('✅ Translation successful');
        return {
          translatedText,
          sourceLang,
          targetLang,
          originalText: text,
        };
      }

      return null;
    } catch (error: any) {
      console.error('❌ Translation API error:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data));
      }
      
      // Re-throw with user-friendly message
      if (error.message.includes('limit reached') || error.message.includes('API key')) {
        throw error; // Pass through our custom message
      }
      
      throw new Error('Translation failed. Please try again or add an API key in Settings.');
    }
  },

  /**
   * Auto-detect language and translate to English or Spanish
   * Uses a simple heuristic: try Spanish→English first, if unchanged try English→Spanish
   */
  async autoTranslate(text: string): Promise<Translation | null> {
    try {
      console.log('🔍 Starting auto-translation...');
      
      // Limit text length to avoid issues
      const maxLength = 500;
      const textToTranslate = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
      
      if (text.length > maxLength) {
        console.log(`⚠️ Text truncated from ${text.length} to ${maxLength} characters`);
      }
      
      // Simple language detection: check for common Spanish words
      const spanishIndicators = ['el', 'la', 'los', 'las', 'de', 'que', 'es', 'un', 'una', 'por', 'para', 'con', 'del'];
      const wordsLower = textToTranslate.toLowerCase().split(/\s+/);
      const spanishWordCount = wordsLower.filter(word => spanishIndicators.includes(word)).length;
      const isLikelySpanish = spanishWordCount >= 2;
      
      if (isLikelySpanish) {
        console.log('🔍 Detected likely Spanish text, translating to English...');
        return await this.translate(textToTranslate, 'es', 'en');
      } else {
        console.log('🔍 Detected likely English text, translating to Spanish...');
        return await this.translate(textToTranslate, 'en', 'es');
      }
    } catch (error: any) {
      console.error('❌ Auto-translation error:', error.message);
      console.error('Error details:', error.response?.data || error);
      throw error;
    }
  },

  /**
   * Format translation for display
   */
  formatTranslation(translation: Translation): string {
    const langNames: Record<string, string> = {
      en: 'English',
      es: 'Spanish',
      auto: 'Auto',
    };

    return `${langNames[translation.sourceLang] || translation.sourceLang} → ${langNames[translation.targetLang]}\n\nTranslation: ${translation.translatedText}`;
  },
};
