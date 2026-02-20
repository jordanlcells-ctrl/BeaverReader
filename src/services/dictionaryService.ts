import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {grammarService} from './grammarService';

const CACHE_PREFIX = '@dict_cache_';
const CACHE_VERSION = 'v2_';
const CACHE_EXPIRY_DAYS = 30;

export interface Definition {
  word: string;
  phonetic?: string;
  meanings: Array<{
    partOfSpeech: string;
    definitions: Array<{
      definition: string;
      example?: string;
      synonyms?: string[];
      antonyms?: string[];
    }>;
  }>;
}

export interface EnhancedDefinition {
  word: string;
  language: 'en' | 'es';
  definition: string;
  /** The English word written in Spanish (e.g. "stuffing" → "relleno") */
  spanishWord?: string;
  spanishTranslation?: string;
  conjugation?: string;
  synonyms?: string[];
  cached?: boolean;
}

export const dictionaryService = {
  detectLanguage(word: string): 'en' | 'es' {
    const cleanWord = word.trim().toLowerCase();
    if (/[áéíóúñü]/.test(cleanWord)) return 'es';
    if (/(ar|er|ir|ción|dad|tad|mente|ando|iendo)$/.test(cleanWord)) return 'es';
    return 'en';
  },

  async getCachedDefinition(word: string): Promise<EnhancedDefinition | null> {
    try {
      const cacheKey = `${CACHE_PREFIX}${CACHE_VERSION}${word.toLowerCase()}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        const cacheAge = Date.now() - parsed.timestamp;
        const maxAge = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        if (cacheAge < maxAge) {
          if (parsed.data.language === 'en' && !parsed.data.spanishTranslation) {
            await AsyncStorage.removeItem(cacheKey);
            return null;
          }
          return {...parsed.data, cached: true};
        }
        await AsyncStorage.removeItem(cacheKey);
      }
      return null;
    } catch (error) {
      return null;
    }
  },

  async cacheDefinition(word: string, data: EnhancedDefinition): Promise<void> {
    try {
      const cacheKey = `${CACHE_PREFIX}${CACHE_VERSION}${word.toLowerCase()}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify({data, timestamp: Date.now()}));
    } catch (error) {
      console.error('Cache write error:', error);
    }
  },

  async getDefinition(word: string): Promise<Definition | null> {
    try {
      const cleanWord = word.trim().toLowerCase().replace(/[.,!?;:]/g, '');
      const response = await axios.get(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`,
      );
      if (response.data?.length > 0) {
        const entry = response.data[0];
        return {word: entry.word, phonetic: entry.phonetic, meanings: entry.meanings};
      }
      return null;
    } catch (error: any) {
      if (error.response?.status === 404) return null;
      throw new Error('Failed to fetch definition');
    }
  },

  formatDefinition(def: Definition): string {
    let formatted = `**${def.word}**`;
    if (def.phonetic) formatted += ` ${def.phonetic}`;
    formatted += '\n\n';
    def.meanings.forEach((meaning, i) => {
      formatted += `*${meaning.partOfSpeech}*\n`;
      meaning.definitions.slice(0, 3).forEach((d, j) => {
        formatted += `${j + 1}. ${d.definition}\n`;
        if (d.example) formatted += `   Example: "${d.example}"\n`;
      });
      if (i < def.meanings.length - 1) formatted += '\n';
    });
    return formatted;
  },

  async getEnglishDefinitionEnhanced(word: string): Promise<EnhancedDefinition | null> {
    try {
      const def = await this.getDefinition(word);
      if (!def) return null;

      const firstMeaning = def.meanings[0];
      const firstDef = firstMeaning.definitions[0];
      const definitionText = `${firstMeaning.partOfSpeech}: ${firstDef.definition}`;

      let synonyms: string[] = [];
      def.meanings.forEach(m => {
        m.definitions.forEach(d => {
          if (d.synonyms) synonyms.push(...d.synonyms);
        });
      });
      synonyms = [...new Set(synonyms)].slice(0, 5);

      let conjugation: string | undefined;
      let spanishTranslation: string | undefined;

      const apiKey = await grammarService.getApiKey();
      if (apiKey) {
        if (firstMeaning.partOfSpeech === 'verb') {
          try {
            conjugation = (await this.getConjugationViaAI(word, 'en')) ?? undefined;
          } catch (_) {}
        }
        try {
          spanishTranslation = (await this.getSpanishTranslationForEnglishWord(word)) ?? undefined;
        } catch (_) {}
      }

      return {
        word: def.word,
        language: 'en',
        definition: definitionText,
        spanishTranslation,
        conjugation,
        synonyms: synonyms.length > 0 ? synonyms : undefined,
      };
    } catch (error) {
      return null;
    }
  },

  async getSpanishTranslationForEnglishWord(word: string): Promise<string | null> {
    try {
      const response = await grammarService.askGrammar(
        word,
        `Translate the English word "${word}" to Spanish. Provide ONLY the Spanish translation(s), separated by commas if there are multiple common translations. Keep it brief (max 3 translations).`,
      );
      return response?.answer?.trim() || null;
    } catch (error) {
      return null;
    }
  },

  async getSpanishDefinitionViaAI(word: string): Promise<EnhancedDefinition | null> {
    try {
      const apiKey = await grammarService.getApiKey();
      if (!apiKey) throw new Error('OpenAI API key required for Spanish lookups. Add it in Settings.');

      const response = await grammarService.askGrammar(
        word,
        `For the Spanish word "${word}", provide:\n1. Definition (brief, in English)\n2. Conjugation (if verb - present tense: yo, tú, él/ella, nosotros, ellos)\n3. 3-5 synonyms in Spanish\n\nFormat as:\nDefinition: [definition]\nConjugation: [if verb]\nSynonyms: [comma-separated]\n\nIf not a verb, say "N/A" for conjugation.`,
      );
      if (!response) return null;

      const lines = response.answer.split('\n');
      let definition = '';
      let conjugation: string | undefined;
      let synonyms: string[] = [];

      lines.forEach(line => {
        if (line.startsWith('Definition:')) definition = line.replace('Definition:', '').trim();
        else if (line.startsWith('Conjugation:')) {
          const c = line.replace('Conjugation:', '').trim();
          if (c !== 'N/A' && c.length > 0) conjugation = c;
        } else if (line.startsWith('Synonyms:')) {
          synonyms = line.replace('Synonyms:', '').trim().split(',').map(s => s.trim()).filter(s => s);
        }
      });

      return {
        word,
        language: 'es',
        definition: definition || response.answer.substring(0, 200),
        conjugation,
        synonyms: synonyms.length > 0 ? synonyms : undefined,
      };
    } catch (error: any) {
      throw error;
    }
  },

  async getConjugationViaAI(word: string, lang: 'en' | 'es'): Promise<string | null> {
    try {
      const prompt = lang === 'en'
        ? `Conjugate the English verb "${word}" in present, past, past participle, and gerund. Format: I [verb], You [verb], Past: [verb], Participle: [verb], Gerund: [verb+ing]`
        : `Conjugate the Spanish verb "${word}" in present tense only. Format: yo [verb], tú [verb], él/ella [verb], nosotros [verb], ellos [verb]`;
      const response = await grammarService.askGrammar(word, prompt);
      return response?.answer?.trim() || null;
    } catch (error) {
      return null;
    }
  },

  async getDefinitionEnhanced(word: string): Promise<EnhancedDefinition | null> {
    try {
      const cleanWord = word.trim().toLowerCase().replace(/[.,!?;:"']/g, '');
      const cached = await this.getCachedDefinition(cleanWord);
      if (cached) return cached;

      const lang = this.detectLanguage(cleanWord);
      let result: EnhancedDefinition | null = null;

      if (lang === 'en') {
        result = await this.getEnglishDefinitionEnhanced(cleanWord);
        if (!result) {
          try {
            result = await this.getSpanishDefinitionViaAI(cleanWord);
          } catch (error: any) {
            if (!error.message.includes('API key')) throw error;
          }
        }
      } else {
        result = await this.getSpanishDefinitionViaAI(cleanWord);
      }

      if (result) await this.cacheDefinition(cleanWord, result);
      return result;
    } catch (error: any) {
      throw error;
    }
  },

  formatDefinitionEnhanced(def: EnhancedDefinition): string {
    let formatted = `📖 ${def.word.toUpperCase()}\n`;
    if (def.cached) formatted += '(cached) ';
    if (def.spanishWord) formatted += `\n🇨🇴 In Spanish: ${def.spanishWord}\n`;
    formatted += '\n';
    const defText = def.definition.replace(/^\s*\*?\*?Definition:?\*?\*?\s*/i, '').trim();
    formatted += `🇨🇦 Meaning:\n${defText}\n\n`;
    if (def.spanishTranslation) {
      formatted += `🇨🇴 Spanish:\n${def.spanishTranslation}\n\n`;
    }
    if (def.conjugation) formatted += `📝 Conjugation:\n${def.conjugation}\n\n`;
    const synonyms = def.synonyms?.slice(0, 3) ?? [];
    if (synonyms.length) formatted += `🔄 Synonyms: ${synonyms.join(', ')}`;
    return formatted;
  },
};
