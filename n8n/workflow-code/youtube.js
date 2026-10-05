const YOUTUBE_KEY = getVar('YOUTUBE_DATA_API_KEY');
if (!YOUTUBE_KEY) throw new Error('Missing YOUTUBE_DATA_API_KEY in n8n Variables');

async function ytJson(url) {
  return await $httpRequest({ method: 'GET', url, responseFormat: 'json', timeout: 25000 });
}

async function channelIdFor(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/(?:channel\/|@)([A-Za-z0-9_.-]+)/);
  const candidate = match ? match[1] : raw;
  if (/^UC[A-Za-z0-9_-]{22}$/.test(candidate)) return candidate;
  const handle = candidate.replace(/^@/, '');
  const res = await ytJson(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${encodeURIComponent(YOUTUBE_KEY)}`);
  if (!res.items?.length) throw new Error(`Could not resolve YouTube channel: ${value}`);
  return res.items[0].id;
}

const sources = await supabase('sources?select=id,name,url,language,category_id&source_type=eq.youtube&is_active=eq.true');
const results = [];

for (const source of sources || []) {
  let found = 0;
  let inserted = 0;
  try {
    const channelId = await channelIdFor(source.url);
    const search = await ytJson(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(channelId)}&maxResults=15&order=date&type=video&key=${encodeURIComponent(YOUTUBE_KEY)}`);

    for (const video of search.items || []) {
      const videoId = video.id?.videoId;
      const snippet = video.snippet || {};
      if (!videoId || !snippet.title) continue;
      found++;

      const existing = await supabase(`articles?select=id&content_hash=eq.${encodeURIComponent(videoId)}&limit=1`);
      if (existing?.length) continue;

      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const rows = await supabase('articles', 'POST', [{
        source_id: source.id,
        source_url: videoUrl,
        canonical_url: videoUrl,
        content_hash: videoId,
        source_type: 'video',
        original_language: source.language || 'en',
        category_id: source.category_id,
        published_date: snippet.publishedAt || null,
        author: snippet.channelTitle || source.name,
        featured_image_url: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || null,
        status: 'pending',
        raw_metadata: {
          title: snippet.title,
          description: snippet.description || '',
          channel_title: snippet.channelTitle,
          youtube_video_id: videoId,
        },
      }], { headers: { Prefer: 'return=representation' } });

      inserted++;
      await logStep(rows?.[0]?.id, source.id, 'fetch', 'success', 'YouTube video ingested', { video_id: videoId });
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
