import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Grammar AI service using OpenAI GPT-4
 * User can provide their own API key via Settings
 */

const OPENAI_API = 'https://api.openai.com/v1/chat/completions';
const API_KEY_STORAGE = '@grammar_api_key';

export interface GrammarResponse {
  answer: string;
  question: string;
}

export const grammarService = {
  /**
   * Save user's OpenAI API key
   */
  async saveApiKey(apiKey: string): Promise<void> {
    await AsyncStorage.setItem(API_KEY_STORAGE, apiKey);
    console.log('✅ OpenAI API key saved');
  },

  /**
   * Get saved API key
   */
  async getApiKey(): Promise<string | null> {
    return await AsyncStorage.getItem(API_KEY_STORAGE);
  },

  /**
   * Clear saved API key
   */
  async clearApiKey(): Promise<void> {
    await AsyncStorage.removeItem(API_KEY_STORAGE);
    console.log('✅ OpenAI API key cleared');
  },

  /**
   * Ask a grammar question about selected text
   */
  async askGrammar(text: string, question?: string): Promise<GrammarResponse | null> {
    try {
      const apiKey = await this.getApiKey();
      
      if (!apiKey) {
        throw new Error('OpenAI API key not configured. Please add your API key in Settings.');
      }

      console.log('🤖 Asking AI grammar question...');
      
      // Default question if none provided
      const userQuestion = question || 'Explain the grammar structure of this text';
      
      const response = await axios.post(
        OPENAI_API,
        {
          model: 'gpt-4o-mini', // Cost-effective model
          messages: [
            {
              role: 'system',
              content: 'You are a helpful grammar and language learning assistant. Provide clear, concise explanations about grammar, syntax, and language structure. Keep answers under 200 words.',
            },
            {
              role: 'user',
              content: `Text: "${text}"\n\nQuestion: ${userQuestion}`,
            },
          ],
          max_tokens: 300,
          temperature: 0.7,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
        }
      );

      if (response.data.choices && response.data.choices.length > 0) {
        const answer = response.data.choices[0].message.content;
        console.log('✅ AI response received');
        return {
          answer,
          question: userQuestion,
        };
      }

      return null;
    } catch (error: any) {
      console.error('❌ Grammar AI error:', error.message);
      
      if (error.response?.status === 401) {
        throw new Error('Invalid OpenAI API key. Please check your API key in Settings.');
      }
      
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      
      throw error;
    }
  },

  /**
   * Format grammar response for display
   */
  formatResponse(response: GrammarResponse): string {
    return `**Question:** ${response.question}\n\n**Answer:**\n${response.answer}`;
  },
};
