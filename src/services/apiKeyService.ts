import AsyncStorage from '@react-native-async-storage/async-storage';

const LIBRETRANSLATE_KEY = '@libretranslate_api_key';

export const apiKeyService = {
  /**
   * Save LibreTranslate API key
   */
  async saveLibreTranslateKey(apiKey: string): Promise<void> {
    try {
      await AsyncStorage.setItem(LIBRETRANSLATE_KEY, apiKey);
      console.log('✅ LibreTranslate API key saved');
    } catch (error) {
      console.error('❌ Failed to save API key:', error);
      throw error;
    }
  },

  /**
   * Get LibreTranslate API key
   */
  async getLibreTranslateKey(): Promise<string | null> {
    try {
      const key = await AsyncStorage.getItem(LIBRETRANSLATE_KEY);
      return key;
    } catch (error) {
      console.error('❌ Failed to get API key:', error);
      return null;
    }
  },

  /**
   * Remove LibreTranslate API key
   */
  async removeLibreTranslateKey(): Promise<void> {
    try {
      await AsyncStorage.removeItem(LIBRETRANSLATE_KEY);
      console.log('✅ LibreTranslate API key removed');
    } catch (error) {
      console.error('❌ Failed to remove API key:', error);
      throw error;
    }
  },
};
