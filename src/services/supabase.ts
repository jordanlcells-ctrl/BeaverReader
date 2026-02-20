import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createClient} from '@supabase/supabase-js';

// TODO: Replace with your actual Supabase credentials
export const supabaseUrl = 'https://mdelgvgjtcznshkohgdm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kZWxndmdqdGN6bnNoa29oZ2RtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4NjE3MjksImV4cCI6MjA4NTQzNzcyOX0.Zf0QeBY2AiCduO4vCmYiiDTwIGe8AHEBg1a2hOhjhJw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
