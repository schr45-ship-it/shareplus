const GEMINI_KEY = getVar('GEMINI_API_KEY');
const FIRECRAWL_KEY = getVar('FIRECRAWL_API_KEY');
if (!GEMINI_KEY) throw new Error('Missing GEMINI_API_KEY in n8n Variables');

// Reset articles stuck mid-pipeline (server restarted while processing)
const stuckSince = new Date(Date.now() - 20 * 60 * 1000).toISOString();
try {
  await supabase(
    `articles?status=in.(extracting,summarizing,translating)&processing_started_at=lt.${stuckSince}`,
    'PATCH',
    { status: 'pending' },
    { headers: { Prefer: 'return=minimal' }, responseFormat: 'text' },
  );
} catch (_) {}

const articles = await supabase('articles?select=*&status=in.(pending,failed)&order=created_at.asc&limit=1');
const categories = await supabase('categories?select=id,slug');
const categoryIds = Object.fromEntries((categories || []).map((c) => [c.slug, c.id]));
const validCategories = (categories || []).map((c) => c.slug);
const fallbackCategory = categoryIds.other ? 'other' : 'technology';

let subByCat = {};
let subIds = {};
let subcategoryColumnOk = false;
try {
  const subs = await supabase('subcategories?select=id,slug,categories(slug)&is_active=eq.true');
  subcategoryColumnOk = true;
  for (const s of subs || []) {
    const catSlug = s.categories?.slug;
    if (!catSlug) continue;
    (subByCat[catSlug] = subByCat[catSlug] || []).push(s.slug);
    subIds[`${catSlug}/${s.slug}`] = s.id;
  }
} catch (_) {}
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
      return cleanText(`${title}\n${author}\n${description}`, 4000);
    } catch (_) {
      return cleanText(`${meta.title || ''}\n${meta.description || ''}`, 4000);
    }
  }

  try {
    const jina = `https://r.jina.ai/http://${article.source_url.replace(/^https?:\/\//, '')}`;
    const text = await _http({ method: 'GET', url: jina, responseFormat: 'text', timeout: 15000 });
    return cleanText(text, 4000);
  } catch (jinaError) {
    if (FIRECRAWL_KEY) {
      const res = await _http({
        method: 'POST',
        url: 'https://api.firecrawl.dev/v1/scrape',
        headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, 'Content-Type': 'application/json' },
        body: { url: article.source_url, formats: ['markdown'] },
        responseFormat: 'json',
        timeout: 20000,
      });
      return cleanText(res?.data?.markdown || res?.markdown || '');
    }
    const html = await _http({ method: 'GET', url: article.source_url, responseFormat: 'text', timeout: 15000 });
    return cleanText(`${meta.title || ''}\n${meta.description || ''}\n${html}`, 4000);
  }
}

async function summarize(article, text) {
  const isVideo = article.source_type === 'video';
  const prompt = `Produce a JSON object with summaries in 4 languages: en, he, es, ar. For each language provide: title (max 70 chars), executive_summary (2-3 short paragraphs), key_takeaways (3-5 strings), tags (3-7 strings), category_slug (one of: ${validCategories.join(', ')}; use "other" when nothing fits), subcategory_slug (pick the single best match for the chosen category from these options: ${Object.entries(subByCat).map(([c, ss]) => `${c}: ${ss.join(', ')}`).join('; ') || 'none'}; use null if unsure), ${isVideo ? 'video_story (a clear, modest narrative retelling of what happens in the video or movie — plot, characters, key scenes — 3-5 short paragraphs; if the content is not a narrative video use null), ' : ''}seo_slug (URL-safe lowercase ASCII, max 70 chars), seo_meta_description (max 155 chars). At the top level also provide: "family_safe" (boolean — false if the content contains sexually explicit, graphic violence, hate or otherwise non-family-safe material), "spoken_language" (the main language actually spoken in the video/audio as a full language name, e.g. "English"; null if unknown). Return ONLY valid JSON in the exact shape {"family_safe":true,"spoken_language":"...","en":{...},"he":{...},"es":{...},"ar":{...}}.\n\nArticle metadata:\n${JSON.stringify(article.raw_metadata || {})}\n\nArticle text:\n${text}`;

  let response;
  let lastError;
  const models = ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
  for (const model of models) {
    try {
      response = await _http({
        method: 'POST',
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`,
        headers: { 'Content-Type': 'application/json' },
        body: {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.25 },
        },
        responseFormat: 'json',
        timeout: 45000,
      });
      break;
    } catch (error) {
      lastError = error;
      if (!/404|429|500|502|503|504|UNAVAILABLE|RESOURCE_EXHAUSTED|timed out/i.test(error.message || '')) throw error;
    }
  }
  if (!response) {
    lastError.transient = true;
    throw lastError;
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
  const prompt = `flat editorial illustration, news thumbnail, minimal, ${String(title || 'technology news').slice(0, 120)}`;
  const seed = article.id.replace(/-/g, '').slice(0, 12);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1200&height=675&nologo=true&seed=${seed}`;
}

for (const article of articles || []) {
  try {
    await updateArticle(article.id, { status: 'extracting', processing_started_at: new Date().toISOString() });
    const text = await fetchText(article);
    if (!text || text.length < 20) throw new Error('Could not extract enough text from source');

    await updateArticle(article.id, { status: 'summarizing' });
    const translations = await summarize(article, text);

    if (translations.family_safe === false) {
      await updateArticle(article.id, { status: 'archived', raw_metadata: { ...(article.raw_metadata || {}), moderation: 'family_safe=false' } });
      await logStep(article.id, article.source_id, 'moderation', 'skipped', 'Content flagged as not family-safe, archived');
      results.push({ article_id: article.id, status: 'archived', reason: 'not family-safe' });
      continue;
    }

    const detected = validCategories.includes(translations.en?.category_slug) ? translations.en.category_slug : fallbackCategory;
    const reqSub = translations.en?.subcategory_slug;
    const subcategoryId = (subByCat[detected] || []).includes(reqSub)
      ? subIds[`${detected}/${reqSub}`]
      : null;
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
          story: item.video_story || null,
          spoken_language: translations.spoken_language || article.raw_metadata?.spoken_language || null,
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
    const publishPatch = {
      status: 'published',
      category_id: categoryIds[detected] || article.category_id,
      ...(subcategoryColumnOk && subcategoryId ? { subcategory_id: subcategoryId } : {}),
      published_at: new Date().toISOString(),
      ...(imageUrl ? { featured_image_url: imageUrl } : {}),
    };
    await updateArticle(article.id, publishPatch);

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
