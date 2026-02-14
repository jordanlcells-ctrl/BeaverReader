// Supabase Edge Function: translate
// Uses optional MyMemory API key for higher limits; rate-limited per user per day.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TRANSLATION_LIMIT_PER_DAY = 100;
const MYMEMORY_API = 'https://api.mymemory.translated.net/get';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getUserIdFromJwt(jwt: string): string | null {
  try {
    const parts = jwt.replace('Bearer ', '').split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Please sign in.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = getUserIdFromJwt(authHeader);
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Invalid token.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { text, sourceLang, targetLang } = body as {
      text?: string;
      sourceLang?: 'en' | 'es';
      targetLang?: 'en' | 'es';
    };
    if (!text || typeof text !== 'string' || !sourceLang || !targetLang) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid text, sourceLang, or targetLang.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const today = new Date().toISOString().slice(0, 10);
    const { data: row } = await supabase
      .from('app_usage')
      .select('grammar_count, translation_count')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    const current = row?.translation_count ?? 0;
    const grammarCount = row?.grammar_count ?? 0;
    if (current >= TRANSLATION_LIMIT_PER_DAY) {
      return new Response(
        JSON.stringify({
          error: `Daily translation limit reached (${TRANSLATION_LIMIT_PER_DAY} per day). Try again tomorrow.`,
          limit: TRANSLATION_LIMIT_PER_DAY,
          used: current,
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const langPair = `${sourceLang}|${targetLang}`;
    const params: Record<string, string> = { q: text, langpair: langPair };
    const mymemoryKey = Deno.env.get('MYMEMORY_API_KEY');
    if (mymemoryKey) params.key = mymemoryKey;

    const url = new URL(MYMEMORY_API);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const transRes = await fetch(url.toString());
    if (!transRes.ok) {
      throw new Error(`MyMemory API error: ${transRes.status}`);
    }
    const transData = await transRes.json();
    const translatedText = transData?.responseData?.translatedText;
    if (!translatedText || transData?.responseStatus === 403) {
      return new Response(
        JSON.stringify({
          error: 'Translation limit reached. Try again later or add MYMEMORY_API_KEY in Supabase for higher limits.',
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase.from('app_usage').upsert(
      {
        user_id: userId,
        date: today,
        grammar_count: grammarCount,
        translation_count: current + 1,
      },
      { onConflict: 'user_id,date' }
    );

    return new Response(
      JSON.stringify({
        translatedText,
        sourceLang,
        targetLang,
        originalText: text,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('Translate function error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
