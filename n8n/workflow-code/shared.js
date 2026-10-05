const getVar = (name) => ($vars && $vars[name]) || ($env && $env[name]) || '';
const SUPABASE_URL = getVar('SUPABASE_URL').replace(/\/$/, '');
const SERVICE_KEY = getVar('SUPABASE_SERVICE_ROLE_KEY');
const SITE_URL = getVar('NEXT_PUBLIC_SITE_URL').replace(/\/$/, '');
const REVALIDATE_SECRET = getVar('REVALIDATE_SECRET');

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in n8n Variables');
}

const supabaseHeaders = (extra = {}) => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  ...extra,
});

async function supabase(path, method = 'GET', body, extra = {}) {
  const options = {
    method,
    url: `${SUPABASE_URL}/rest/v1/${path}`,
    headers: supabaseHeaders(extra.headers || {}),
    timeout: 30000,
    responseFormat: extra.responseFormat || 'json',
  };
  if (body !== undefined) options.body = body;
  return await $httpRequest(options);
}

async function logStep(articleId, sourceId, step, status, message, metadata = {}) {
  try {
    await supabase('processing_logs', 'POST', {
      article_id: articleId || null,
      source_id: sourceId || null,
      step,
      status,
      message: String(message || '').slice(0, 2000),
      metadata,
    }, { headers: { Prefer: 'return=minimal' }, responseFormat: 'text' });
  } catch (_) {}
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
