const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY || '';
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET || '';

if (!SUPABASE_URL || !SERVICE_KEY || !GEMINI_KEY) {
  throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and GEMINI_API_KEY are required');
}

const headers = (extra = {}) => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  ...extra,
});

async function supabase(path, method = 'GET', body, extra = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: headers(extra.headers || {}),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${method} ${path}: ${response.status} ${text}`);
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

function cleanText(text, max = 12000) {
  return String(text || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function slugify(value, fallback) {
  const slug = String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 65);
  return slug || fallback;
}

async function logStep(articleId, sourceId, step, status, message, metadata = {}) {
  try {
    await supabase('processing_logs', 'POST', {
      article_id: articleId,
      source_id: sourceId,
      step,
      status,
      message: String(message || '').slice(0, 2000),
      metadata,
    }, { headers: { Prefer: 'return=minimal' } });
  } catch (error) {
    console.warn('Could not write processing log:', error.message);
  }
}

async function fetchText(article) {
  const meta = article.raw_metadata || {};
  if (article.source_type === 'video') {
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(article.source_url)}&format=json`);
      if (response.ok) {
        const embed = await response.json();
        return cleanText(`${embed.title || meta.title || ''}\n${embed.author_name || meta.channel_title || ''}\n${meta.description || ''}`, 8000);
      }
    } catch {}
    return cleanText(`${meta.title || ''}\n${meta.description || ''}`, 8000);
  }

  try {
    const response = await fetch(`https://r.jina.ai/http://${article.source_url.replace(/^https?:\/\//, '')}`, {
      signal: AbortSignal.timeout(30000),
    });
    if (response.ok) return cleanText(await response.text());
  } catch {}

  if (FIRECRAWL_KEY) {
    try {
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: article.source_url, formats: ['markdown'] }),
        signal: AbortSignal.timeout(40000),
      });
      if (response.ok) {
        const data = await response.json();
        return cleanText(data?.data?.markdown || data?.markdown || '');
      }
    } catch {}
  }

  try {
    const response = await fetch(article.source_url, { signal: AbortSignal.timeout(30000) });
    if (response.ok) return cleanText(`${meta.title || ''}\n${meta.description || ''}\n${await response.text()}`);
  } catch {}

  return cleanText(`${meta.title || ''}\n${meta.description || ''}`);
}

async function summarize(article, text) {
  const prompt = `Produce a JSON object with summaries in 4 languages: en, he, es, ar. For each language provide: title (max 70 chars), executive_summary (2-3 short paragraphs), key_takeaways (3-5 strings), tags (3-7 strings), category_slug (one of: technology, business, science, health, world, entertainment, sports), seo_slug (URL-safe lowercase ASCII, max 70 chars), seo_meta_description (max 155 chars). Return ONLY valid JSON in the exact shape {"en":{...},"he":{...},"es":{...},"ar":{...}}.\n\nArticle metadata:\n${JSON.stringify(article.raw_metadata || {})}\n\nArticle text:\n${text}`;

  let response;
  let bodyText = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.25 },
      }),
      signal: AbortSignal.timeout(120000),
    });
    bodyText = await response.text();
    if (response.ok) break;
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 3) {
      const error = new Error(`Gemini ${response.status}: ${bodyText}`);
      error.transient = [429, 500, 502, 503, 504].includes(response.status);
      throw error;
    }
    console.warn(`Gemini is busy (${response.status}); retrying article ${article.id} in ${attempt * 20}s...`);
    await new Promise((resolve) => setTimeout(resolve, attempt * 20000));
  }

  let output = '';
  try {
    const data = JSON.parse(bodyText);
    output = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
  } catch {
    output = bodyText;
  }
  output = output.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const parsed = JSON.parse(output);
  for (const lang of ['en', 'he', 'es', 'ar']) {
    if (!parsed[lang]?.title || !parsed[lang]?.executive_summary) throw new Error(`Gemini response missing ${lang}`);
  }
  return parsed;
}

const processLimit = Number.parseInt(process.env.PROCESS_LIMIT || '10', 10) || 10;
const articles = await supabase(`articles?select=*&status=in.(pending,failed)&order=created_at.asc&limit=${processLimit}`) || [];
const categories = await supabase('categories?select=id,slug') || [];
const categoryIds = Object.fromEntries(categories.map((category) => [category.slug, category.id]));
const validCategories = ['technology', 'business', 'science', 'health', 'world', 'entertainment', 'sports'];
const results = [];

console.log(`Found ${articles.length} pending articles`);

for (const article of articles) {
  try {
    console.log(`Processing ${article.id} (${article.source_type})...`);
    await supabase(`articles?id=eq.${article.id}`, 'PATCH', {
      status: 'extracting',
      processing_started_at: new Date().toISOString(),
    }, { headers: { Prefer: 'return=minimal' } });

    const text = await fetchText(article);
    if (text.length < 20) throw new Error('Could not extract enough text from source');

    await supabase(`articles?id=eq.${article.id}`, 'PATCH', { status: 'summarizing' }, { headers: { Prefer: 'return=minimal' } });
    const translations = await summarize(article, text);
    const detected = validCategories.includes(translations.en?.category_slug) ? translations.en.category_slug : 'technology';
    const suffix = article.id.slice(0, 8);

    const rows = ['en', 'he', 'es', 'ar'].map((lang) => {
      const item = translations[lang];
      const summary = item.executive_summary || '';
      return {
        article_id: article.id,
        language: lang,
        title: String(item.title).slice(0, 180),
        seo_slug: `${slugify(item.seo_slug || item.title, `article-${suffix}`)}-${suffix}`,
        seo_meta_title: String(item.title).slice(0, 70),
        seo_meta_description: String(item.seo_meta_description || summary).slice(0, 160),
        summary: {
          executive_summary: summary,
          key_takeaways: Array.isArray(item.key_takeaways) ? item.key_takeaways : [],
          body: summary,
        },
        tags: Array.isArray(item.tags) ? item.tags.slice(0, 8) : [],
        word_count: summary.split(/\s+/).filter(Boolean).length,
        is_primary: lang === article.original_language || lang === 'en',
      };
    });

    await supabase('article_translations?on_conflict=article_id,language', 'POST', rows, {
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    });

    await supabase(`articles?id=eq.${article.id}`, 'PATCH', {
      status: 'published',
      category_id: categoryIds[detected] || article.category_id,
      published_at: new Date().toISOString(),
    }, { headers: { Prefer: 'return=minimal' } });

    if (SITE_URL && REVALIDATE_SECRET) {
      try {
        await fetch(`${SITE_URL}/api/revalidate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-revalidate-secret': REVALIDATE_SECRET },
          body: JSON.stringify({ slug: rows[0].seo_slug, category: detected, locales: ['en', 'he', 'es', 'ar'] }),
        });
      } catch {}
    }

    await logStep(article.id, article.source_id, 'publish', 'success', 'Processed by local direct pipeline');
    results.push({ article_id: article.id, status: 'published', title: rows.find((row) => row.language === 'he')?.title });
  } catch (error) {
    const transient = Boolean(error.transient) || /Gemini (429|500|502|503|504)|UNAVAILABLE|RESOURCE_EXHAUSTED|timed out/i.test(error.message);
    const metadata = { ...(article.raw_metadata || {}), processing_error: error.message, retryable: transient };
    await supabase(`articles?id=eq.${article.id}`, 'PATCH', {
      status: transient ? 'pending' : 'failed',
      raw_metadata: metadata,
    }, { headers: { Prefer: 'return=minimal' } });
    await logStep(article.id, article.source_id, 'error', transient ? 'skipped' : 'error', error.message);
    results.push({ article_id: article.id, status: transient ? 'pending' : 'failed', error: error.message });
    console.error(`${transient ? 'Deferred' : 'Failed'} ${article.id}: ${error.message}`);
  }
}

console.log('\nResults:');
for (const result of results) console.log(JSON.stringify(result));
