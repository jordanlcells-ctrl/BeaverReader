/**
 * Reading preferences: EPUB font size, PDF default view.
 * Persisted to AsyncStorage so they apply across app restarts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_EPUB_FONT_SIZE = '@beaver_epub_font_size';
const KEY_PDF_READER_MODE = 'pdf_reader_mode';
const KEY_PDF_TEXT_FONT_SIZE = '@beaver_pdf_text_font_size';
const KEY_APP_THEME = '@beaver_app_theme';
const KEY_NATIVE_LANGUAGE = '@beaver_native_language';
const KEY_TARGET_LANGUAGE = '@beaver_target_language';

export type AppTheme = 'light' | 'dark' | 'system';
export type EpubFontSize = 'small' | 'medium' | 'large';
export type PdfReaderMode = 'text' | 'pdf';
export type PdfTextFontSize = 'small' | 'medium' | 'large';
export type LanguageCode = 'en' | 'es' | 'fr' | 'pt' | 'de' | 'it' | 'pl' | 'ja' | 'ko' | 'zh' | 'ru';

export const SUPPORTED_LANGUAGES: {code: LanguageCode; name: string; flag: string}[] = [
  {code: 'en', name: 'English',    flag: '🇨🇦'},
  {code: 'es', name: 'Spanish',    flag: '🇨🇴'},
  {code: 'fr', name: 'French',     flag: '🇫🇷'},
  {code: 'pt', name: 'Portuguese', flag: '🇧🇷'},
  {code: 'de', name: 'German',     flag: '🇩🇪'},
  {code: 'it', name: 'Italian',    flag: '🇮🇹'},
  {code: 'pl', name: 'Polish',     flag: '🇵🇱'},
  {code: 'ja', name: 'Japanese',   flag: '🇯🇵'},
  {code: 'ko', name: 'Korean',     flag: '🇰🇷'},
  {code: 'zh', name: 'Chinese',    flag: '🇨🇳'},
  {code: 'ru', name: 'Russian',    flag: '🇷🇺'},
];

export function getLangMeta(code: LanguageCode) {
  return SUPPORTED_LANGUAGES.find(l => l.code === code) ?? SUPPORTED_LANGUAGES[0];
}

export const EPUB_FONT_SIZE_PX: Record<EpubFontSize, number> = {
  small: 16,
  medium: 18,
  large: 22,
};

export const PDF_TEXT_FONT_SIZE_PX: Record<PdfTextFontSize, number> = {
  small: 16,
  medium: 19,
  large: 24,
};

export const readingPreferencesService = {
  async getEpubFontSize(): Promise<EpubFontSize> {
    try {
      const v = await AsyncStorage.getItem(KEY_EPUB_FONT_SIZE);
      if (v === 'small' || v === 'medium' || v === 'large') return v;
      return 'medium';
    } catch {
      return 'medium';
    }
  },

  async setEpubFontSize(size: EpubFontSize): Promise<void> {
    await AsyncStorage.setItem(KEY_EPUB_FONT_SIZE, size);
  },

  /** Returns font size in px for the EPUB reader WebView. */
  async getEpubFontSizePx(): Promise<number> {
    const size = await this.getEpubFontSize();
    return EPUB_FONT_SIZE_PX[size];
  },

  async getPdfDefaultView(): Promise<PdfReaderMode> {
    try {
      const v = await AsyncStorage.getItem(KEY_PDF_READER_MODE);
      if (v === 'text' || v === 'pdf') return v;
      return 'text';
    } catch {
      return 'text';
    }
  },

  async setPdfDefaultView(mode: PdfReaderMode): Promise<void> {
    await AsyncStorage.setItem(KEY_PDF_READER_MODE, mode);
  },

  async getPdfTextFontSize(): Promise<PdfTextFontSize> {
    try {
      const v = await AsyncStorage.getItem(KEY_PDF_TEXT_FONT_SIZE);
      if (v === 'small' || v === 'medium' || v === 'large') return v;
      return 'medium';
    } catch {
      return 'medium';
    }
  },

  async setPdfTextFontSize(size: PdfTextFontSize): Promise<void> {
    await AsyncStorage.setItem(KEY_PDF_TEXT_FONT_SIZE, size);
  },

  async getPdfTextFontSizePx(): Promise<number> {
    const size = await this.getPdfTextFontSize();
    return PDF_TEXT_FONT_SIZE_PX[size];
  },

  async getAppTheme(): Promise<AppTheme> {
    try {
      const v = await AsyncStorage.getItem(KEY_APP_THEME);
      if (v === 'light' || v === 'dark' || v === 'system') return v;
      return 'light';
    } catch {
      return 'light';
    }
  },

  async setAppTheme(theme: AppTheme): Promise<void> {
    await AsyncStorage.setItem(KEY_APP_THEME, theme);
  },

  async getNativeLanguage(): Promise<LanguageCode> {
    try {
      const v = await AsyncStorage.getItem(KEY_NATIVE_LANGUAGE);
      if (SUPPORTED_LANGUAGES.some(l => l.code === v)) return v as LanguageCode;
      return 'en';
    } catch {
      return 'en';
    }
  },

  async setNativeLanguage(code: LanguageCode): Promise<void> {
    await AsyncStorage.setItem(KEY_NATIVE_LANGUAGE, code);
  },

  async getTargetLanguage(): Promise<LanguageCode> {
    try {
      const v = await AsyncStorage.getItem(KEY_TARGET_LANGUAGE);
      if (SUPPORTED_LANGUAGES.some(l => l.code === v)) return v as LanguageCode;
      return 'es';
    } catch {
      return 'es';
    }
  },

  async setTargetLanguage(code: LanguageCode): Promise<void> {
    await AsyncStorage.setItem(KEY_TARGET_LANGUAGE, code);
  },
};
