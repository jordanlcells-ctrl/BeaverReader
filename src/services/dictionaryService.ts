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
  language: string;
  definition: string;
  /** Equivalent word in the user's target language */
  targetWord?: string;
  /** Definition in the user's target language */
  targetDefinition?: string;
  /** Conjugation in target language */
  conjugation?: string;
  /** Conjugation in native language */
  nativeConjugation?: string;
  /** Lema en idioma nativo para UI: "población — definición…" (rellenado en cliente traduciendo targetWord) */
  nativeHeadword?: string;
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
          if (parsed.data.language === 'en' && !parsed.data.targetDefinition && !parsed.data.targetWord) {
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

  formatDefinitionEnhanced(
    def: EnhancedDefinition,
    nativeMeta: {code?: string; flag: string; name: string} = {flag: '🇨🇦', name: 'English'},
    targetMeta: {code?: string; flag: string; name: string} = {flag: '🇨🇴', name: 'Spanish'},
  ): string {
    const cleanDef = this.stripEmptyNumberedLines(
      def.definition.replace(/^\s*\*?\*?Definition:?\*?\*?\s*/i, '').trim()
    );

    let formatted = `📖 ${def.word.toUpperCase()}\n\n`;

    // Native language definition
    formatted += `${nativeMeta.flag} ${nativeMeta.name}:\n${cleanDef || '—'}\n\n`;

    // Conjugations (if any)
    const nativeConj = def.nativeConjugation
      ? this.stripEmptyNumberedLines(def.nativeConjugation.replace(/^NATIVE_CONJUGATION:\s*/i, ''))
      : '';
    const targetConj = def.conjugation
      ? this.stripEmptyNumberedLines(def.conjugation.replace(/^CONJUGATION:\s*/i, ''))
      : '';
    if (nativeConj || targetConj) {
      formatted += `🔀 Conjugation:\n`;
      if (nativeConj) formatted += `${nativeMeta.flag} ${nativeConj}\n`;
      if (targetConj) formatted += `${targetMeta.flag} ${targetConj}\n`;
      formatted += '\n';
    }

    // Target language definition
    const rawTargetDef = def.targetDefinition
      ? this.stripEmptyNumberedLines(def.targetDefinition.replace(/^TARGET_DEFINITION:\s*/i, ''))
      : '';
    const nativeHeadword = def.nativeHeadword?.trim();
    if (nativeHeadword || def.targetWord || rawTargetDef) {
      const targetContent = nativeHeadword
        ? nativeHeadword
        : def.targetWord && rawTargetDef
          ? `${def.targetWord} — ${rawTargetDef}`
          : def.targetWord || rawTargetDef;
      formatted += `${targetMeta.flag} ${targetMeta.name}:\n${targetContent}\n\n`;
    }

    // Synonyms
    const synonyms = def.synonyms?.slice(0, 3) ?? [];
    if (synonyms.length) {
      formatted += `🔄 Synonyms: ${synonyms.join(', ')}`;
    }

    return formatted.trimEnd();
  },
};

/** Nativo español pero el modelo devolvió inglés en `definition` */
export function definitionLooksEnglishWhenNativeSpanish(definition: string): boolean {
  const t = stripDefinitionForLangHeuristic(definition);
  if (!t) return false;
  if (/[áéíóúñü¿¡]/.test(t)) return false;
  if (
    /\b(el|la|los|las|un|una|es|son|está|están|del|que|para|con|por|como|significa|refiere|verbo|forma|pasado|presente|significado)\b/i.test(
      t,
    )
  ) {
    return false;
  }
  if (/^(The |It |A |An |This |That |When |Past |Present |These |Those )\b/i.test(t)) return true;
  if (/\b(the |past tense|present tense|meaning of|meaning to|verb '| is a | was a )\b/i.test(t)) return true;
  return false;
}

/** Quita comillas/markdown inicial para que ^The / heurísticas no fallen en `**The clothes…**`. */
export function stripDefinitionForLangHeuristic(definition: string): string {
  return definition
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^[\s*"'„«_(\[-]+/g, '')
    .replace(/[\s*"'”»_)\]]+$/g, '')
    .trim();
}

/**
 * El modelo suele meter inglés en `definition` aunque el nativo sea pl/fr/de/…
 * (las etiquetas UI sí usan el idioma de ajustes). Si devuelve true, conviene traducir en→nativo o reintentar define.
 */
export function nativeDefinitionLooksLikeEnglish(nativeLang: string, definition: string): boolean {
  const t = stripDefinitionForLangHeuristic(definition);
  if (!t || nativeLang === 'en') return false;
  if (nativeLang === 'es') return definitionLooksEnglishWhenNativeSpanish(definition);

  if (nativeLang === 'pl') {
    if (/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(t)) return false;
    if (
      /\b(jest|nie|się|że|lub|dla|jako|ludzi|grupy|grupa|miejscu|osób|zbiorowisko|zebranych|wielka|duża|znaczy|oznacza)\b/i.test(
        t,
      )
    ) {
      return false;
    }
  }
  if (nativeLang === 'fr') {
    if (/[àâäéèêëïîôùûüÿçœæ]/i.test(t)) return false;
    if (/\b(le |la |les |un |une |des |est |sont |avec |pour |dans |que |qui |signifie)\b/i.test(t)) return false;
  }
  if (nativeLang === 'de') {
    if (/[äöüßÄÖÜ]/.test(t)) return false;
    if (/\b(der |die |das |und |ist |ein |eine |mit |für |nicht |sich |bedeutet)\b/i.test(t)) return false;
  }
  if (nativeLang === 'it') {
    if (/[àèéìíîòóù]/i.test(t)) return false;
    if (/\b(il |la |lo |gli |un |una |è |sono |con |per |che |significa)\b/i.test(t)) return false;
  }
  if (nativeLang === 'pt') {
    if (/[ãõáàâéêíóôúç]/i.test(t)) return false;
    if (/\b(o |a |os |as |um |uma |é |são |com |para |que |significa)\b/i.test(t)) return false;
  }
  if (nativeLang === 'ru' && /[а-яёА-ЯЁ]/.test(t)) return false;
  if (nativeLang === 'ja' && /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(t)) return false;
  if (nativeLang === 'ko' && /[\uac00-\ud7af]/.test(t)) return false;
  if (nativeLang === 'zh' && /[\u4e00-\u9fff]/.test(t)) return false;

  if (/^(the |it |a |an |this |that |when |past |present |these |those |to |is a |are a |was a |were |means |refers )\b/i.test(t))
    return true;
  if (
    /\b(the |past tense|present tense|meaning of| is a | was a | are a |group of people|gathered together|living in|one place|refers to|total number)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /\b(clothes|clothing|garments?|outfit|attire|worn by|style worn|by someone|worn by someone)\b/i.test(t)
  ) {
    return true;
  }
  if (
    ['pl', 'fr', 'de', 'it', 'pt'].includes(nativeLang) &&
    /^(The|A|An|It|This|That)\s+[a-záéíóú]/i.test(t)
  ) {
    return true;
  }
  return false;
}

/**
 * Nativo ≠ inglés y el modelo metió la glosa en inglés: traducir aunque falle un regex puntual.
 * Evita falsos positivos con polaco (p. ej. "to", "i") al no usar listas enormes de palabras cortas en inglés.
 */
export function shouldTranslateDefinitionToNative(
  nativeLang: string,
  targetLang: string,
  definition: string,
): boolean {
  if (nativeLang === 'en' || !definition?.trim()) return false;
  const t = stripDefinitionForLangHeuristic(definition);
  if (!t) return false;

  if (nativeLang === 'pl' && /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(t)) return false;
  if (nativeLang === 'es' && /[áéíóúñü¿¡]/.test(t)) return false;

  if (nativeDefinitionLooksLikeEnglish(nativeLang, definition)) return true;

  // Polaco aprendiendo inglés: glosas tipo diccionario que no activan el detector genérico
  // (p. ej. comillas tipográficas ‘’ que rompían el test "solo ASCII").
  if (nativeLang === 'pl' && targetLang === 'en') {
    const proseChars = /^[\s\x20-\x7E\u00A0\u2013\u2014\u2018\u2019\u201c\u201d'’‘’\-–—.!,?:;()]+$/u;
    if (proseChars.test(t) && t.length >= 12) {
      const englishDictGloss =
        /\b(plural of|singular of|past tense of|present tense of|referring to|human beings|in general|a group of|group of individuals|variant of|version of|meaning of the word|the word means|one who|something that)\b/i.test(
          t,
        ) ||
        /^(The|A|An|It|This|That|One|When|Past|Present|These|Those|There|They|We|You)\s+[a-z]/i.test(t);
      if (englishDictGloss) return true;
    }
  }

  return false;
}

/**
 * Repara JSON del modelo: conjugaciones filtradas en `definition`, o paradigma inglés en `target_definition`.
 */
export function normalizeMistralEnhancedDef(
  def: EnhancedDefinition,
  nativeLang: string,
  targetLang: string,
): EnhancedDefinition {
  let definition = (def.definition || '').trim();
  let nativeConjugation = def.nativeConjugation?.trim();
  let conjugation = def.conjugation?.trim();
  let targetDefinition = def.targetDefinition?.trim();

  const leakSplit = definition.split(
    /\s*(?:ENGLISH|ENGUSH|NATIVE|SPANISH)?\s*_?\s*CONJUGATION\s*:?\s*/i,
  );
  if (leakSplit.length > 1) {
    definition = leakSplit[0].trim();
    const tail = leakSplit.slice(1).join(' ').trim().replace(/^:\s*/, '');
    if (tail) {
      if (
        nativeLang === 'es' &&
        /[áéíóúñü¿¡]|\b(yo|tú|él|ella|nosotros|vosotros|ellos|ellas)\b/i.test(tail)
      ) {
        nativeConjugation = nativeConjugation || tail;
      } else if (!nativeConjugation) {
        nativeConjugation = tail;
      } else if (!conjugation) {
        conjugation = tail;
      }
    }
  }

  const conjInDef = definition.match(/^([\s\S]+?)\s+CONJUGATION\s*:\s*([\s\S]+)$/i);
  if (conjInDef) {
    definition = conjInDef[1].trim();
    const tail = conjInDef[2].trim();
    if (tail && !nativeConjugation) nativeConjugation = tail;
  }

  const looksLikeEnVerbParadigm = (s: string) =>
    /^(I\s|You\s|He\/she|She\s|We\s|They\s)/i.test(s) &&
    /,\s*(you|he|she|we|they)\s/i.test(s);

  if (
    targetLang === 'en' &&
    targetDefinition &&
    looksLikeEnVerbParadigm(targetDefinition) &&
    !conjugation
  ) {
    conjugation = targetDefinition;
    targetDefinition = undefined;
  }

  return {
    ...def,
    definition: dictionaryService.stripEmptyNumberedLines(definition),
    nativeConjugation: nativeConjugation || undefined,
    conjugation: conjugation || undefined,
    targetDefinition: targetDefinition || undefined,
  };
}
