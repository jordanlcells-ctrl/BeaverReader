// Supabase Edge Function: mistral
// Single backend for Define, Translate, Ask AI. Uses MISTRAL_API_KEY; app-wide monthly cap.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MISTRAL_CHAT_URL = 'https://api.mistral.ai/v1/chat/completions';

const LANG_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', fr: 'French', pt: 'Portuguese',
  de: 'German',  it: 'Italian', pl: 'Polish',  ja: 'Japanese',
  ko: 'Korean',  zh: 'Chinese', ru: 'Russian',
};
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


type DefineFields = {
  definition: string;
  targetWord?: string;
  targetDefinition?: string;
  conjugation?: string;
  nativeConjugation?: string;
  synonyms?: string[];
  word: string;
};

function parseDefineResponse(
  content: string,
  text: string,
  nativeLangCode: string,
  targetLangCode: string,
): DefineFields {
  let parsed: Record<string, unknown> = {};
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('define JSON parse error:', e, 'raw:', content.slice(0, 300));
  }

  const synonymsRaw = Array.isArray(parsed.synonyms) ? parsed.synonyms : [];
  const synonyms = synonymsRaw
    .filter((s: unknown) => typeof s === 'string' && s.trim())
    .slice(0, 3) as string[];

  let definition = typeof parsed.definition === 'string' ? parsed.definition.trim() : '';

  // Mistral sometimes ignores JSON instructions and stuffs numbered sections inside "definition".
  // e.g. "1. POLISH DEFINITION\ntext\n2. CONJUGATIONS\n—\n3. ENGLISH DEFINITION\ncourse"
  // Detect this and extract just the first section's text content.
  if (/^\s*\d+\.\s+[A-Z]/.test(definition)) {
    // Try to extract the first section's body (text after the first "N. HEADING" line)
    const firstBody = definition.match(/^\s*\d+\.[^\n]+\n([\s\S]+?)(?=\n\s*\d+\.|$)/);
    if (firstBody?.[1]) {
      // Also try to grab the target/English section
      if (!parsed.target_definition) {
        const targetBody = definition.match(
          /\d+\.\s+(?:ENGLISH|TARGET)[^\n]*\n([\s\S]+?)(?=\n\s*\d+\.|$)/i
        );
        if (targetBody?.[1]) {
          (parsed as Record<string, unknown>).target_definition = targetBody[1].trim();
        }
      }
      // Extract synonyms section if missing
      if (!parsed.synonyms || !(parsed.synonyms as unknown[]).length) {
        const synBody = definition.match(/\d+\.\s+SYNONYM[^\n]*\n([\s\S]+?)(?=\n\s*\d+\.|$)/i);
        if (synBody?.[1]) {
          (parsed as Record<string, unknown>).synonyms = synBody[1]
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
            .slice(0, 3);
        }
      }
      definition = firstBody[1].trim();
    } else {
      // Fallback: strip all "N. SECTION HEADING" lines entirely
      definition = definition.replace(/^\s*\d+\.\s+[A-Z][A-Z\s()]+\s*$/gm, '').trim();
    }
  }

  let nativeConjugation =
    typeof parsed.native_conjugation === 'string' && parsed.native_conjugation
      ? parsed.native_conjugation.trim()
      : undefined;
  let conjugation =
    typeof parsed.conjugation === 'string' && parsed.conjugation ? parsed.conjugation.trim() : undefined;
  let targetDefinition =
    typeof parsed.target_definition === 'string' ? parsed.target_definition.trim() : undefined;

  const leakSplit = definition.split(/\s*(?:ENGLISH|ENGUSH|NATIVE|SPANISH)?\s*_?\s*CONJUGATION\s*:?\s*/i);
  if (leakSplit.length > 1) {
    definition = leakSplit[0].trim();
    const tail = leakSplit.slice(1).join(' ').trim().replace(/^:\s*/, '');
    if (tail) {
      if (
        nativeLangCode === 'es' &&
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

  const looksLikeEnParadigm = (s: string) =>
    /^(I\s|You\s|He\/she|She\s|We\s|They\s)/i.test(s) && /,\s*(you|he|she|we|they)\s/i.test(s);
  if (
    targetLangCode === 'en' &&
    targetDefinition &&
    looksLikeEnParadigm(targetDefinition) &&
    !conjugation
  ) {
    conjugation = targetDefinition;
    targetDefinition = undefined;
  }

  return {
    definition,
    targetWord: typeof parsed.target_word === 'string' ? parsed.target_word.trim() : undefined,
    targetDefinition,
    conjugation,
    nativeConjugation,
    synonyms: synonyms.length ? synonyms : undefined,
    word: text,
  };
}

/** Returns true if `text` looks like English prose (so we know to translate it). */
function definitionIsEnglish(nativeLangCode: string, text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // Non-Latin scripts are definitively not English
  if (/[а-яёА-ЯЁ]/.test(t)) return false; // Cyrillic
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(t)) return false; // Japanese kana
  if (/[\u4e00-\u9fff]/.test(t)) return false; // CJK
  if (/[\uac00-\ud7af]/.test(t)) return false; // Korean
  // Language-specific diacritics signal the correct language
  if (nativeLangCode === 'pl' && /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(t)) return false;
  if (nativeLangCode === 'es' && /[áéíóúñü¿¡]/.test(t)) return false;
  if (nativeLangCode === 'fr' && /[àâäéèêëïîôùûüÿçœæ]/i.test(t)) return false;
  if (nativeLangCode === 'de' && /[äöüßÄÖÜ]/.test(t)) return false;
  if (nativeLangCode === 'it' && /[àèéìíîòóù]/i.test(t)) return false;
  if (nativeLangCode === 'pt' && /[ãõáàâéêíóôúç]/i.test(t)) return false;
  // Looks like English if it starts with common English patterns or contains English-only words
  if (/^(The |A |An |It |This |That |One |When |In )/i.test(t)) return true;
  if (/\b(the|is a|are a|was a|refers to|meaning of|past tense|used to|a type of|a place|a person|a group)\b/i.test(t)) return true;
  return false;
}

async function callMistral(
  apiKey: string,
  systemPrompt: string,
  userContent: string,
  maxTokens = 400,
  temperature = 0.4,
  jsonMode = false,
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
      temperature,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
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

    if (!action || !['define', 'translate', 'ask', 'toc'].includes(action)) {
      return json({ error: 'Missing or invalid "action". Use define, translate, ask, or toc.' }, 400);
    }
    if (!text) {
      return json({ error: 'Missing or invalid "text".' }, 400);
    }

    // TOC extraction is a one-time-per-book utility; skip per-user daily cap
    if (action === 'toc') {
      // Check + increment monthly app cap only
      const monthly = await checkAndIncrementMonthlyUsage(supabaseService);
      if (!monthly.allowed) return json({ error: monthly.error }, 429);

      const totalPages = typeof body.totalPages === 'number' ? body.totalPages : 9999;
      const systemPrompt =
        `You are a table of contents extractor for PDF books. Given raw text from the first pages of a book, identify and extract the table of contents entries.\n` +
        `Return ONLY a valid JSON array with NO other text, markdown, or code fences:\n` +
        `[{"title": "Chapter Name", "page": 12}, ...]\n\n` +
        `Rules:\n` +
        `- Only include entries that are clearly chapter/section headings paired with a page number.\n` +
        `- Page numbers must be positive integers (printed page numbers; roman numerals i=1, ii=2, iii=3, etc.).\n` +
        `- Ignore book title, author name, running headers/footers, blank content, index entries.\n` +
        `- If a clear table of contents is not present, return [].\n` +
        `- Do not invent entries; only use what is literally on the page.\n` +
        `- Maximum 200 entries.`;
      const { content } = await callMistral(mistralKey, systemPrompt, text, 900);

      let toc: Array<{ title: string; page: number }> = [];
      try {
        const m = content.match(/\[[\s\S]*\]/);
        if (m) {
          const parsed = JSON.parse(m[0]);
          if (Array.isArray(parsed)) {
            toc = parsed
              .filter((e) => e.title && typeof e.page === 'number' && e.page > 0)
              .map((e) => ({ title: String(e.title).trim(), page: Math.round(e.page) }));
          }
        }
      } catch (parseErr) {
        console.error('TOC JSON parse failed:', parseErr, 'raw:', content.slice(0, 200));
      }
      return json({ toc }, 200);
    }

    // Per-user daily cap (define / translate / ask only)
    const userCheck = await getAndCheckUserDailyUsage(supabaseUser, userId, action as 'define' | 'translate' | 'ask');
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

    if (action === 'define' as string) {
      const nativeLangCode = typeof body.nativeLang === 'string' && body.nativeLang ? body.nativeLang : 'en';
      const targetLangCode = typeof body.targetLang === 'string' && body.targetLang ? body.targetLang : 'es';
      const nativeLangName = LANG_NAMES[nativeLangCode] ?? 'English';
      const targetLangName = LANG_NAMES[targetLangCode] ?? 'Spanish';

      // Single call: ask for definition in native language directly.
      // If Mistral returns English instead (detectable), fall back to translation.
      const nativeInstruction = nativeLangCode !== 'en'
        ? `IMPORTANT: "definition" MUST be written entirely in ${nativeLangName} — NOT English.\n`
        : '';
      const defSystemPrompt =
        `You are a dictionary. Output ONLY valid JSON, no other text.\n` +
        nativeInstruction +
        `{"definition":"<1-2 sentence definition in ${nativeLangName}>","target_word":"<equivalent word/phrase in ${targetLangName}>","target_definition":"<1 sentence meaning in ${targetLangName}>","conjugation":"<if verb: present tense in ${targetLangName}, else null>","synonyms":["<up to 3 synonyms in ${targetLangName}>"]}\n` +
        `Rules: Always include all fields. Under 120 words total.`;

      let { content } = await callMistral(mistralKey, defSystemPrompt, `Word: "${text}"`, 400, 0.2, true);
      let fields = parseDefineResponse(content, text, nativeLangCode, targetLangCode);

      // Only translate if native != English AND the definition came back in English (fallback).
      let nativeDefinition = fields.definition;
      if (nativeLangCode !== 'en' && fields.definition && definitionIsEnglish(nativeLangCode, fields.definition)) {
        const transSystemPrompt =
          `Translate to ${nativeLangName}. Output ONLY the translation — no quotes, no explanation, no English.\n` +
          `Use standard ${nativeLangName} spelling with all proper diacritics.`;
        const { content: transContent } = await callMistral(
          mistralKey, transSystemPrompt, fields.definition, 200, 0.1
        );
        if (transContent.trim()) nativeDefinition = transContent.trim();
      }

      result = { ...fields, definition: nativeDefinition, word: text };
    } else if (action === 'translate') {
      const sourceLang = typeof body.sourceLang === 'string' && body.sourceLang ? body.sourceLang : 'en';
      const targetLang = typeof body.targetLang === 'string' && body.targetLang ? body.targetLang : 'es';
      if (sourceLang === targetLang) {
        return json({ error: 'sourceLang and targetLang must differ.' }, 400);
      }
      const glossMode = body.glossMode === true;
      const sourceLangName = LANG_NAMES[sourceLang] ?? sourceLang;
      const targetLangName = LANG_NAMES[targetLang] ?? targetLang;
      let systemPrompt =
        `You are a professional translator. Translate from ${sourceLangName} to ${targetLangName}.\n` +
        `Output ONLY the translated text entirely in ${targetLangName}. Do not leave phrases in ${sourceLangName} (except proper names). No quotes, preamble, or explanation.`;
      if (glossMode) {
        systemPrompt +=
          `\nThe input is a short English dictionary definition (1–2 sentences). Preserve the meaning; output must read as a natural definition in ${targetLangName}, not a word-for-word calque.`;
      }
      if (targetLang === 'pl') {
        systemPrompt +=
          `\nFor Polish: use standard spelling with diacritics (ą, ć, ę, ł, ń, ó, ś, ź, ż) where appropriate.`;
      }
      const maxTok = glossMode ? 400 : 200;
      const temp = glossMode ? 0.12 : 0.4;
      const { content } = await callMistral(mistralKey, systemPrompt, text, maxTok, temp);
      result = {
        translatedText: content,
        sourceLang,
        targetLang,
        originalText: text,
      };
    } else {
      // ask
      const question = typeof body.question === 'string' ? body.question.trim() : 'Explain the grammar or language of this text.';
      const nativeLangCode = typeof body.nativeLang === 'string' && body.nativeLang ? body.nativeLang : 'en';
      const nativeLangName = LANG_NAMES[nativeLangCode] ?? 'English';
      const systemPrompt =
        `You are a grammar and language learning assistant. Answer ONLY grammar and language-related questions about the given text.\n\n` +
        `CRITICAL: You MUST reply entirely in ${nativeLangName}. Keep answers clear and under 200 words. ` +
        `If the question is not about grammar or language, politely say you only answer grammar and language questions (in ${nativeLangName}).`;
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
