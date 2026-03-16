import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  /** English past tense (e.g. I told, you told, ...) */
  englishConjugation?: string;
  /** Spanish conjugation (present tense) */
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

      return {
        word: def.word,
        language: 'en',
        definition: definitionText,
        synonyms: synonyms.length > 0 ? synonyms : undefined,
      };
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
      if (lang !== 'en') return null;
      const result = await this.getEnglishDefinitionEnhanced(cleanWord);
      if (result) await this.cacheDefinition(cleanWord, result);
      return result;
    } catch (error: any) {
      throw error;
    }
  },

  /** Remove empty numbered lines (e.g. "2." with no text) and strip numbering from content */
  stripEmptyNumberedLines(text: string): string {
    return text
      .split(/\n/)
      .filter((line) => {
        const t = line.trim();
        if (!t) return false;
        if (/^\d+\.\s*$/.test(t)) return false;
        return true;
      })
      .map((line) => line.replace(/^\s*\d+\.\s*/, '').trim())
      .filter((line) => line.length > 0)
      .join('\n')
      .trim();
  },

  formatDefinitionEnhanced(def: EnhancedDefinition): string {
    let formatted = `📖 ${def.word.toUpperCase()}\n`;
    if (def.cached) formatted += '(cached) ';
    formatted += '\n';
    const rawDef = def.definition.replace(/^\s*\*?\*?Definition:?\*?\*?\s*/i, '').trim();
    const defText = this.stripEmptyNumberedLines(rawDef);
    formatted += `🇨🇦 English:\n${defText}\n\n`;
    if (def.englishConjugation) {
      const conj = this.stripEmptyNumberedLines(def.englishConjugation.replace(/^ENGLISH_CONJUGATION:\s*/i, ''));
      if (conj) formatted += `📝 Past: ${conj}\n\n`;
    }
    if (def.spanishWord || def.spanishTranslation) {
      formatted += `🇨🇴 Spanish:\n`;
      if (def.spanishWord) formatted += `${def.spanishWord}`;
      if (def.spanishWord && def.spanishTranslation) formatted += ' — ';
      if (def.spanishTranslation) formatted += this.stripEmptyNumberedLines(def.spanishTranslation.replace(/^SPANISH_DEFINITION:\s*/i, ''));
      formatted += '\n\n';
    }
    if (def.conjugation) {
      const conj = this.stripEmptyNumberedLines(def.conjugation.replace(/^CONJUGATION:\s*/i, ''));
      if (conj) formatted += `📝 Conjugation:\n${conj}\n\n`;
    }
    const synonyms = def.synonyms?.slice(0, 3) ?? [];
    if (synonyms.length) formatted += `🔄 Synonyms: ${synonyms.join(', ')}`;
    return formatted;
  },
};
