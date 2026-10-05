const GEMINI_KEY = getVar('GEMINI_API_KEY');
const FIRECRAWL_KEY = getVar('FIRECRAWL_API_KEY');
if (!GEMINI_KEY) throw new Error('Missing GEMINI_API_KEY in n8n Variables');

const articles = await supabase('articles?select=*&status=in.(pending,failed)&order=created_at.asc&limit=2');
const categories = await supabase('categories?select=id,slug');
const categoryIds = Object.fromEntries((categories || []).map((c) => [c.slug, c.id]));
const validCategories = ['technology', 'business', 'science', 'health', 'world', 'entertainment', 'sports'];
const results = [];

async function updateArticle(id, patch) {
  await supabase(`articles?id=eq.${id}`, 'PATCH', patch, { headers: { Prefer: 'return=minimal' }, responseFormat: 'text' });
}

async function fetchText(article) {
  const meta = article.raw_metadata || {};
  if (article.source_type === 'video') {
    try {
      const embed = await _http({ method: 'GET', url: `https://www.youtube.com/oembed?url=${encodeURIComponent(article.source_url)}&format=json`, responseFormat: 'json', timeout: 15000 });
      const title = embed.title || meta.title || '';
      const author = embed.author_name || meta.channel_title || '';
      const description = meta.description || '';
      return cleanText(`${title}\n${author}\n${description}`, 8000);
    } catch (_) {
      return cleanText(`${meta.title || ''}\n${meta.description || ''}`, 8000);
    }
  }

  try {
    const jina = `https://r.jina.ai/http://${article.source_url.replace(/^https?:\/\//, '')}`;
    const text = await _http({ method: 'GET', url: jina, responseFormat: 'text', timeout: 25000 });
    return cleanText(text);
  } catch (jinaError) {
    if (FIRECRAWL_KEY) {
      const res = await _http({
        method: 'POST',
        url: 'https://api.firecrawl.dev/v1/scrape',
        headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, 'Content-Type': 'application/json' },
        body: { url: article.source_url, formats: ['markdown'] },
        responseFormat: 'json',
        timeout: 35000,
      });
      return cleanText(res?.data?.markdown || res?.markdown || '');
    }
    const html = await _http({ method: 'GET', url: article.source_url, responseFormat: 'text', timeout: 25000 });
    return cleanText(`${meta.title || ''}\n${meta.description || ''}\n${html}`);
  }
}

async function summarize(article, text) {
  const prompt = `Produce a JSON object with summaries in 4 languages: en, he, es, ar. For each language provide: title (max 70 chars), executive_summary (2-3 short paragraphs), key_takeaways (3-5 strings), tags (3-7 strings), category_slug (one of: technology, business, science, health, world, entertainment, sports), seo_slug (URL-safe lowercase ASCII, max 70 chars), seo_meta_description (max 155 chars). Return ONLY valid JSON in the exact shape {"en":{...},"he":{...},"es":{...},"ar":{...}}.\n\nArticle metadata:\n${JSON.stringify(article.raw_metadata || {})}\n\nArticle text:\n${text}`;

  let response;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      response = await _http({
        method: 'POST',
        url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`,
        headers: { 'Content-Type': 'application/json' },
        body: {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.25 },
        },
        responseFormat: 'json',
        timeout: 90000,
      });
      break;
    } catch (error) {
      if (attempt === 3) {
        error.transient = /429|500|502|503|504|UNAVAILABLE|RESOURCE_EXHAUSTED|timed out/i.test(error.message || '');
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 20000));
    }
  }

  let output = response?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  output = output.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(output);
  } catch (_) {
    const start = output.indexOf('{');
    const end = output.lastIndexOf('}');
    parsed = JSON.parse(output.slice(start, end + 1));
  }

  for (const lang of ['en', 'he', 'es', 'ar']) {
    if (!parsed[lang]?.title || !parsed[lang]?.executive_summary) throw new Error(`Gemini response missing ${lang}`);
  }
  return parsed;
}

async function generateImage(article, title) {
  if (article.featured_image_url) return article.featured_image_url;
  try {
    const prompt = `flat editorial illustration, news thumbnail, minimal, ${String(title || 'technology news').slice(0, 200)}`;
    const img = await _http({
      method: 'GET',
      url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1200&height=675&nologo=true&seed=${article.id.replace(/-/g, '').slice(0, 12)}`,
      timeout: 90000,
      binary: true,
    });
    const buf = Buffer.from(img);
    if (buf.length < 5000) return null;
    const path = `${article.id}.jpg`;
    await _http({
      method: 'POST',
      url: `${SUPABASE_URL}/storage/v1/object/article-images/${path}`,
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
      body: buf,
      timeout: 60000,
    });
    return `${SUPABASE_URL}/storage/v1/object/public/article-images/${path}`;
  } catch (e) {
    await logStep(article.id, article.source_id, 'publish', 'skipped', `image generation skipped: ${e.message}`);
    return null;
  }
}

for (const article of articles || []) {
  try {
    await updateArticle(article.id, { status: 'extracting', processing_started_at: new Date().toISOString() });
    const text = await fetchText(article);
    if (!text || text.length < 20) throw new Error('Could not extract enough text from source');

    await updateArticle(article.id, { status: 'summarizing' });
    const translations = await summarize(article, text);
    const detected = validCategories.includes(translations.en?.category_slug) ? translations.en.category_slug : 'technology';
    const suffix = article.id.slice(0, 8);

    await updateArticle(article.id, { status: 'translating' });
    const rows = ['en', 'he', 'es', 'ar'].map((lang) => {
      const item = translations[lang];
      const baseSlug = slugify(item.seo_slug || item.title, `article-${suffix}`);
      const summary = item.executive_summary || '';
      return {
        article_id: article.id,
        language: lang,
        title: String(item.title).slice(0, 180),
        seo_slug: `${baseSlug}-${suffix}`,
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
      responseFormat: 'text',
    });

    const imageUrl = await generateImage(article, translations.en?.title);
    await updateArticle(article.id, {
      status: 'published',
      category_id: categoryIds[detected] || article.category_id,
      published_at: new Date().toISOString(),
      ...(imageUrl ? { featured_image_url: imageUrl } : {}),
    });

    if (SITE_URL && REVALIDATE_SECRET) {
      try {
        await _http({
          method: 'POST',
          url: `${SITE_URL}/api/revalidate`,
          headers: { 'Content-Type': 'application/json', 'x-revalidate-secret': REVALIDATE_SECRET },
          body: { slug: rows[0].seo_slug, category: detected, locales: ['en', 'he', 'es', 'ar'] },
          responseFormat: 'json',
          timeout: 15000,
        });
      } catch (_) {}
    }

    await logStep(article.id, article.source_id, 'publish', 'success', 'Article processed and published', { languages: ['en', 'he', 'es', 'ar'] });
    results.push({ article_id: article.id, status: 'published', languages: ['en', 'he', 'es', 'ar'] });
  } catch (error) {
    const transient = Boolean(error.transient) || /429|500|502|503|504|UNAVAILABLE|RESOURCE_EXHAUSTED|timed out/i.test(error.message || '');
    const metadata = { ...(article.raw_metadata || {}), processing_error: error.message, retryable: transient };
    await updateArticle(article.id, { status: transient ? 'pending' : 'failed', raw_metadata: metadata });
    await logStep(article.id, article.source_id, 'error', transient ? 'skipped' : 'error', error.message);
    results.push({ article_id: article.id, status: transient ? 'pending' : 'failed', error: error.message });
  }
}

return [{ json: { ok: true, processed: results.length, results } }];
