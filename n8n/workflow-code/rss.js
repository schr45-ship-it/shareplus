const sources = await supabase('sources?select=id,name,url,language,category_id&source_type=eq.rss&is_active=eq.true');
const results = [];

for (const source of sources || []) {
  let found = 0;
  let inserted = 0;
  try {
    const xml = await _http({ method: 'GET', url: source.url, responseFormat: 'text', timeout: 25000 });
    const blocks = String(xml).match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) || [];

    for (const block of blocks.slice(0, 20)) {
      const sourceUrl = xmlLink(block);
      const title = xmlTag(block, ['title']);
      if (!sourceUrl || !title) continue;

      found++;
      const canonicalUrl = sourceUrl.split('#')[0].split('?')[0];
      const contentHash = stableHash(`${title.toLowerCase()}|${canonicalUrl}`);
      const existing = await supabase(`articles?select=id&content_hash=eq.${encodeURIComponent(contentHash)}&limit=1`);
      if (existing?.length) continue;

      const description = xmlTag(block, ['description', 'summary', 'content', 'content:encoded']);
      const published = xmlTag(block, ['pubDate', 'published', 'updated', 'dc:date']);
      const image = block.match(/<(?:media:content|enclosure)[^>]+(?:url|href)=["']([^"']+)["']/i)?.[1] || null;

      const rows = await supabase('articles', 'POST', [{
        source_id: source.id,
        source_url: sourceUrl,
        canonical_url: canonicalUrl,
        content_hash: contentHash,
        source_type: 'news',
        original_language: source.language || 'en',
        category_id: source.category_id,
        published_date: published ? new Date(published).toISOString() : null,
        author: xmlTag(block, ['author', 'dc:creator']) || null,
        featured_image_url: image,
        status: 'pending',
        raw_metadata: { title, description, feed_title: source.name },
      }], { headers: { Prefer: 'return=representation' } });

      inserted++;
      await logStep(rows?.[0]?.id, source.id, 'fetch', 'success', 'Article ingested from RSS', { source_url: sourceUrl });
    }

    await supabase(`sources?id=eq.${source.id}`, 'PATCH', { last_checked_at: new Date().toISOString(), last_error: null }, { headers: { Prefer: 'return=minimal' }, responseFormat: 'text' });
    results.push({ source: source.name, found, inserted });
  } catch (error) {
    await supabase(`sources?id=eq.${source.id}`, 'PATCH', { last_checked_at: new Date().toISOString(), last_error: error.message }, { headers: { Prefer: 'return=minimal' }, responseFormat: 'text' });
    await logStep(null, source.id, 'fetch', 'error', error.message, { source_url: source.url });
    results.push({ source: source.name, error: error.message });
  }
}

return [{ json: { ok: true, results } }];
