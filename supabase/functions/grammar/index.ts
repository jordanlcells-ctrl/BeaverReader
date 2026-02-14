// Supabase Edge Function: grammar
// Uses your OpenAI API key; rate-limited per user per day.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GRAMMAR_LIMIT_PER_DAY = 30;
const OPENAI_API = 'https://api.openai.com/v1/chat/completions';

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

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: 'Grammar service not configured. Add OPENAI_API_KEY in Supabase secrets.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { text, question } = body as { text?: string; question?: string };
    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid "text".' }),
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

    const current = row?.grammar_count ?? 0;
    const translationCount = row?.translation_count ?? 0;
    if (current >= GRAMMAR_LIMIT_PER_DAY) {
      return new Response(
        JSON.stringify({
          error: `Daily limit reached (${GRAMMAR_LIMIT_PER_DAY} per day). Try again tomorrow or add your own API key in Settings for more.`,
          limit: GRAMMAR_LIMIT_PER_DAY,
          used: current,
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userQuestion = question || 'Explain the grammar structure of this text';
    const openaiRes = await fetch(OPENAI_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
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
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error('OpenAI error:', openaiRes.status, errText);
      if (openaiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: 'AI service is busy. Please try again later.' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(errText || 'OpenAI request failed');
    }

    const openaiData = await openaiRes.json();
    const answer =
      openaiData.choices?.[0]?.message?.content?.trim() || 'No response.';

    await supabase.from('app_usage').upsert(
      {
        user_id: userId,
        date: today,
        grammar_count: current + 1,
        translation_count: translationCount,
      },
      { onConflict: 'user_id,date' }
    );

    return new Response(
      JSON.stringify({ answer, question: userQuestion }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('Grammar function error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
