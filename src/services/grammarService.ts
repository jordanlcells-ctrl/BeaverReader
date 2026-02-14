import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Grammar AI using the user's own OpenAI API key (add in Settings).
 * Get a key at https://platform.openai.com/api-keys
 */

const OPENAI_API = 'https://api.openai.com/v1/chat/completions';
const API_KEY_STORAGE = '@grammar_api_key';

export interface GrammarResponse {
  answer: string;
  question: string;
}

export const grammarService = {
  async saveApiKey(apiKey: string): Promise<void> {
    await AsyncStorage.setItem(API_KEY_STORAGE, apiKey);
    console.log('✅ OpenAI API key saved');
  },

  async getApiKey(): Promise<string | null> {
    return await AsyncStorage.getItem(API_KEY_STORAGE);
  },

  async clearApiKey(): Promise<void> {
    await AsyncStorage.removeItem(API_KEY_STORAGE);
    console.log('✅ OpenAI API key cleared');
  },

  async askGrammar(text: string, question?: string): Promise<GrammarResponse | null> {
    try {
      const apiKey = await this.getApiKey();
      if (!apiKey) {
        throw new Error(
          'Add your OpenAI API key in Settings to use grammar. Get a key at platform.openai.com/api-keys'
        );
      }

      const userQuestion = question || 'Explain the grammar structure of this text';
      console.log('🤖 Asking AI grammar question...');

      const response = await axios.post(
        OPENAI_API,
        {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are a helpful grammar and language learning assistant. Provide clear, concise explanations about grammar, syntax, and language structure. Keep answers under 200 words.',
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
            Authorization: `Bearer ${apiKey}`,
          },
        }
      );

      if (response.data.choices?.[0]?.message?.content) {
        console.log('✅ Grammar response received');
        return {
          answer: response.data.choices[0].message.content,
          question: userQuestion,
        };
      }

      return null;
    } catch (err: any) {
      if (err?.response?.status === 401) {
        throw new Error('Invalid OpenAI API key. Check your key in Settings.');
      }
      if (err?.response?.status === 429) {
        throw new Error('Rate limit exceeded. Try again later.');
      }
      if (err?.message) throw err;
      throw new Error('Grammar request failed. Please try again.');
    }
  },

  formatResponse(response: GrammarResponse): string {
    return `**Question:** ${response.question}\n\n**Answer:**\n${response.answer}`;
  },
};
