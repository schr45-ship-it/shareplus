const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const YOUTUBE_KEY = process.env.YOUTUBE_DATA_API_KEY || '';

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
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
  } catch {}
}

function stableHash(value) {
  return Buffer.from(String(value || '')).toString('base64url').slice(0, 120);
}

function decodeXml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function xmlTag(xml, names) {
  for (const name of names) {
    const match = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
    if (match) return decodeXml(match[1]);
  }
  return '';
}

function xmlLink(item) {
  const href = item.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1];
  return decodeXml(href || xmlTag(item, ['link', 'guid']));
}

async function updateSource(id, error = null) {
  await supabase(`sources?id=eq.${id}`, 'PATCH', {
    last_checked_at: new Date().toISOString(),
    last_error: error,
  }, { headers: { Prefer: 'return=minimal' } });
}

async function ingestRss() {
  const sources = await supabase('sources?select=id,name,url,language,category_id&source_type=eq.rss&is_active=eq.true') || [];
  const results = [];

  for (const source of sources) {
    let found = 0;
    let inserted = 0;
    try {
      const response = await fetch(source.url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`RSS HTTP ${response.status}`);
      const xml = await response.text();
      const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) || [];

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
        let publishedDate = null;
        try { publishedDate = published ? new Date(published).toISOString() : null; } catch {}

        const rows = await supabase('articles', 'POST', [{
          source_id: source.id,
          source_url: sourceUrl,
          canonical_url: canonicalUrl,
          content_hash: contentHash,
          source_type: 'news',
          original_language: source.language || 'en',
          category_id: source.category_id,
          published_date: publishedDate,
          author: xmlTag(block, ['author', 'dc:creator']) || null,
          featured_image_url: image,
          status: 'pending',
          raw_metadata: { title, description, feed_title: source.name },
        }], { headers: { Prefer: 'return=representation' } });

        inserted++;
        await logStep(rows?.[0]?.id, source.id, 'fetch', 'success', 'Article ingested locally from RSS', { source_url: sourceUrl });
      }

      await updateSource(source.id);
      results.push({ type: 'rss', source: source.name, found, inserted });
    } catch (error) {
      await updateSource(source.id, error.message);
      await logStep(null, source.id, 'fetch', 'error', error.message, { source_url: source.url });
      results.push({ type: 'rss', source: source.name, error: error.message });
    }
  }
  return results;
}

async function channelIdFor(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/(?:channel\/|@)([A-Za-z0-9_.-]+)/);
  const candidate = match ? match[1] : raw;
  if (/^UC[A-Za-z0-9_-]{22}$/.test(candidate)) return candidate;
  const handle = candidate.replace(/^@/, '');
  const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${encodeURIComponent(YOUTUBE_KEY)}`);
  const data = await response.json();
  if (!response.ok || !data.items?.length) throw new Error(`Could not resolve YouTube channel: ${value}`);
  return data.items[0].id;
}

async function ingestYouTube() {
  if (!YOUTUBE_KEY) return [{ type: 'youtube', skipped: 'YOUTUBE_DATA_API_KEY not set' }];
  const sources = await supabase('sources?select=id,name,url,language,category_id&source_type=eq.youtube&is_active=eq.true') || [];
  const results = [];

  for (const source of sources) {
    let found = 0;
    let inserted = 0;
    try {
      const channelId = await channelIdFor(source.url);
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(channelId)}&maxResults=15&order=date&type=video&key=${encodeURIComponent(YOUTUBE_KEY)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(JSON.stringify(data));

      for (const video of data.items || []) {
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
        await logStep(rows?.[0]?.id, source.id, 'fetch', 'success', 'YouTube video ingested locally', { video_id: videoId });
      }

      await updateSource(source.id);
      results.push({ type: 'youtube', source: source.name, found, inserted });
    } catch (error) {
      await updateSource(source.id, error.message);
      await logStep(null, source.id, 'fetch', 'error', error.message, { source_url: source.url });
      results.push({ type: 'youtube', source: source.name, error: error.message });
    }
  }
  return results;
}

const results = [
  ...(await ingestRss()),
  ...(await ingestYouTube()),
];

console.log('\nIngestion results:');
for (const result of results) console.log(JSON.stringify(result));
