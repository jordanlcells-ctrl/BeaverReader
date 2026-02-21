// Supabase Edge Function: mistral
// Single backend for Define, Translate, Ask AI. Uses MISTRAL_API_KEY; app-wide monthly cap.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MISTRAL_CHAT_URL = 'https://api.mistral.ai/v1/chat/completions';
const MONTHLY_REQUEST_CAP = Number(Deno.env.get('MONTHLY_REQUEST_CAP')) || 4000;
const DAILY_USER_CAP = 50; // total define + translate + ask per user per day

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

function getMonth(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

async function checkAndIncrementMonthlyUsage(
  supabaseService: ReturnType<typeof createClient>
): Promise<{ allowed: boolean; error?: string }> {
  const month = getMonth();
  const { data: row } = await supabaseService
    .from('app_monthly_usage')
    .select('total_requests, total_tokens')
    .eq('month', month)
    .maybeSingle();

  const current = row?.total_requests ?? 0;
  if (current >= MONTHLY_REQUEST_CAP) {
    return {
      allowed: false,
      error: `App limit reached for this month. Try again later.`,
    };
  }

  const { error: updateError } = await supabaseService
    .from('app_monthly_usage')
    .upsert(
      {
        month,
        total_requests: current + 1,
        total_tokens: (row?.total_tokens ?? 0), // we'll add tokens if Mistral returns usage
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'month' }
    );

  if (updateError) {
    console.error('app_monthly_usage update error:', updateError);
    return { allowed: false, error: 'Could not record usage.' };
  }
  return { allowed: true };
}

async function getAndCheckUserDailyUsage(
  supabaseUser: ReturnType<typeof createClient>,
  userId: string,
  action: 'define' | 'translate' | 'ask'
): Promise<{ allowed: boolean; error?: string }> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: row } = await supabaseUser
    .from('app_usage')
    .select('grammar_count, translation_count, ask_count')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  const grammar = row?.grammar_count ?? 0;
  const translation = row?.translation_count ?? 0;
  const ask = row?.ask_count ?? 0;
  const total = grammar + translation + ask;
  if (total >= DAILY_USER_CAP) {
    return {
      allowed: false,
      error: `Daily limit reached (${DAILY_USER_CAP} actions per day). Try again tomorrow.`,
    };
  }
  return { allowed: true };
}

async function incrementUserUsage(
  supabaseUser: ReturnType<typeof createClient>,
  userId: string,
  action: 'define' | 'translate' | 'ask'
) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: row } = await supabaseUser
    .from('app_usage')
    .select('grammar_count, translation_count, ask_count')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  const grammar = row?.grammar_count ?? 0;
  const translation = row?.translation_count ?? 0;
  const ask = row?.ask_count ?? 0;

  const updates: Record<string, number> = {
    user_id: userId as any,
    date: today as any,
    grammar_count: grammar + (action === 'define' ? 1 : 0),
    translation_count: translation + (action === 'translate' ? 1 : 0),
    ask_count: ask + (action === 'ask' ? 1 : 0),
  };

  await supabaseUser.from('app_usage').upsert(updates, {
    onConflict: 'user_id,date',
  });
}

async function callMistral(
  apiKey: string,
  systemPrompt: string,
  userContent: string,
  maxTokens = 400
): Promise<{ content: string; usage?: { total_tokens?: number } }> {
  const res = await fetch(MISTRAL_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_tokens: maxTokens,
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Mistral API error:', res.status, errText);
    throw new Error(res.status === 429 ? 'AI service busy. Try again later.' : errText || 'Mistral request failed');
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim() || '';
  const usage = data.usage;
  return { content, usage };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (obj: object, status: number) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Unauthorized. Please sign in.' }, 401);
    }

    const userId = getUserIdFromJwt(authHeader);
    if (!userId) {
      return json({ error: 'Invalid token.' }, 401);
    }

    const mistralKey = Deno.env.get('MISTRAL_API_KEY');
    if (!mistralKey) {
      return json(
        { error: 'Mistral service not configured. Add MISTRAL_API_KEY in Supabase secrets.' },
        503
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseServiceKey) {
      return json({ error: 'Server misconfiguration (missing service role).' }, 503);
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const action = body?.action as string;
    const text = typeof body?.text === 'string' ? body.text.trim() : '';

    if (!action || !['define', 'translate', 'ask'].includes(action)) {
      return json({ error: 'Missing or invalid "action". Use define, translate, or ask.' }, 400);
    }
    if (!text) {
      return json({ error: 'Missing or invalid "text".' }, 400);
    }

    // Per-user daily cap
    const userCheck = await getAndCheckUserDailyUsage(supabaseUser, userId, action);
    if (!userCheck.allowed) {
      return json({ error: userCheck.error }, 429);
    }

    // App-wide monthly cap (must run before calling Mistral; we increment after success)
    const { data: monthlyData } = await supabaseService
      .from('app_monthly_usage')
      .select('total_requests')
      .eq('month', getMonth())
      .maybeSingle();
    const monthlyUsed = monthlyData?.total_requests ?? 0;
    if (monthlyUsed >= MONTHLY_REQUEST_CAP) {
      return json({
        error: 'App limit reached for this month. Try again later.',
      }, 429);
    }

    let result: object;

    if (action === 'define') {
      const systemPrompt = `You are a dictionary for English learners. For the given English word or phrase, provide in this exact order (use ONLY these labels, no numbered list):
- The meaning in English (1-2 sentences). Write it as plain text, no number or label.
- SPANISH_WORD: the word or phrase in Spanish (one word or short phrase).
- SPANISH_DEFINITION: the same meaning in Spanish (one sentence).
- If it is a verb: ENGLISH_CONJUGATION: past tense only in English (I told, you told, he/she told, we told, they told). If not a verb, omit.
- If it is a verb: CONJUGATION: present tense in Spanish (yo digo, tú dices, él/ella dice, nosotros decimos, ellos/ellas dicen). If not a verb, omit.
- SYNONYMS: exactly up to 3 synonyms, comma-separated.
Do not add empty numbered items. Always include SPANISH_WORD and SPANISH_DEFINITION. Max 3 synonyms. Keep under 180 words.`;
      const { content } = await callMistral(mistralKey, systemPrompt, `Word/phrase: "${text}"`);
      const section = (label: string) => {
        const re = new RegExp(`${label}:\\s*(.+?)(?=\\n\\n|\\n[A-Z_]+:|$)`, 's');
        const m = content.match(re);
        return m ? m[1].trim() : undefined;
      };
      const spanishWord = section('SPANISH_WORD');
      const spanishTranslation = section('SPANISH_DEFINITION') || section('SPANISH DEFINITION');
      const englishConjugation = section('ENGLISH_CONJUGATION');
      const conjugation = section('CONJUGATION');
      const synonymsStr = section('SYNONYMS');
      const synonyms = synonymsStr
        ? synonymsStr.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 3)
        : undefined;
      const definitionOnly = content
        .replace(/\n?\s*SPANISH_WORD:\s*.+?(?=\n\n|\n[A-Z_]+:|$)/s, '')
        .replace(/\n?\s*SPANISH_DEFINITION:\s*.+?(?=\n\n|\n[A-Z_]+:|$)/s, '')
        .replace(/\n?\s*SPANISH DEFINITION:\s*.+?(?=\n\n|\n[A-Z_]+:|$)/s, '')
        .replace(/\n?\s*ENGLISH_CONJUGATION:\s*.+?(?=\n\n|\n[A-Z_]+:|$)/s, '')
        .replace(/\n?\s*CONJUGATION:\s*.+?(?=\n\n|\n[A-Z_]+:|$)/s, '')
        .replace(/\n?\s*SYNONYMS:\s*.+?(?=\n\n|$)/s, '')
        .replace(/\n\s*\d+\.\s*\n/g, '\n')
        .trim();
      result = {
        definition: definitionOnly,
        spanishWord: spanishWord || undefined,
        spanishTranslation: spanishTranslation || undefined,
        englishConjugation: englishConjugation || undefined,
        conjugation: conjugation || undefined,
        synonyms: synonyms?.length ? synonyms : undefined,
        word: text,
      };
    } else if (action === 'translate') {
      const sourceLang = body.sourceLang === 'es' ? 'es' : 'en';
      const targetLang = body.targetLang === 'es' ? 'es' : 'en';
      if (sourceLang === targetLang) {
        return json({ error: 'sourceLang and targetLang must differ.' }, 400);
      }
      const systemPrompt = `You are a translator. Translate the following text from ${sourceLang === 'es' ? 'Spanish' : 'English'} to ${targetLang === 'es' ? 'Spanish' : 'English'}. Reply with ONLY the translation, no explanation.`;
      const { content } = await callMistral(mistralKey, systemPrompt, text, 200);
      result = {
        translatedText: content,
        sourceLang,
        targetLang,
        originalText: text,
      };
    } else {
      // ask
      const question = typeof body.question === 'string' ? body.question.trim() : 'Explain the grammar or language of this text.';
      // Prefer the QUESTION language for the reply (user asked in their chosen language)
      const spanishIndicators = /\b(el|la|los|las|de|que|es|en|un|una|por|para|con|del|al|yo|tú|él|ella|nosotros|ellos|ser|estar|haber|tiene|son|está|significa|qué|cómo|cuál|cuáles|por qué)\b/i;
      const spanishChars = /[áéíóúñüÁÉÍÓÚÑÜ]/;
      const questionSpanishWords = (question.match(spanishIndicators) || []).length;
      const questionHasSpanishChars = spanishChars.test(question);
      const replyInSpanish = questionHasSpanishChars || questionSpanishWords >= 1;
      const replyLang = replyInSpanish ? 'Spanish' : 'English';
      const systemPrompt = `You are a grammar and language learning assistant. Answer ONLY grammar and language-related questions about the given text.

CRITICAL: You MUST reply entirely in ${replyLang}. The user asked their question in ${replyLang}, so your whole answer must be in ${replyLang}. Do not switch to English if the user asked in Spanish.
When explaining grammar, give examples in the language of the text they are asking about. Keep answers clear and under 200 words. If the question is not about grammar or language, politely say you only answer grammar and language questions (in ${replyLang}).`;
      const { content } = await callMistral(
        mistralKey,
        systemPrompt,
        `Text: "${text}"\n\nQuestion: ${question}`,
        350
      );
      result = { answer: content, question };
    }

    // Increment monthly usage (we already checked; now record)
    const { data: monthly } = await supabaseService
      .from('app_monthly_usage')
      .select('total_requests, total_tokens')
      .eq('month', getMonth())
      .maybeSingle();
    const nextRequests = (monthly?.total_requests ?? 0) + 1;
    const nextTokens = monthly?.total_tokens ?? 0;
    await supabaseService.from('app_monthly_usage').upsert(
      {
        month: getMonth(),
        total_requests: nextRequests,
        total_tokens: nextTokens,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'month' }
    );

    await incrementUserUsage(supabaseUser, userId, action);

    return json(result, 200);
  } catch (e) {
    console.error('Mistral function error:', e);
    return json(
      { error: e instanceof Error ? e.message : 'Server error' },
      500
    );
  }
});
