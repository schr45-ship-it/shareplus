// Deploy v3 workflows to n8n via public API. Usage:
//   N8N_API_KEY=... node scripts/deploy-via-api.mjs
const N8N = (process.env.N8N_URL || 'http://localhost:5678').replace(/\/$/, '');
const KEY = process.env.N8N_API_KEY;
if (!KEY) throw new Error('N8N_API_KEY required');

const fs = await import('fs');
const path = await import('path');
const dir = path.resolve(import.meta.dirname, '../n8n/workflows');

async function api(p, method = 'GET', body) {
  const r = await fetch(`${N8N}/api/v1${p}`, {
    method,
    headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${p}: ${r.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const wanted = {
  'rss-ingestion-v3.json': 'ai-shareplus: RSS Ingestion (v3)',
  'youtube-ingestion-v3.json': 'ai-shareplus: YouTube Ingestion (v3)',
  'ai-processing-v3.json': 'ai-shareplus: AI Summarize & Translate (v3)',
};

const existing = (await api('/workflows?limit=100')).data || [];
console.log('Existing:', existing.map((w) => `${w.name}(${w.active ? 'on' : 'off'})`).join(', '));

// Deactivate stale workflows that are not the wanted v3 set
for (const w of existing) {
  const isWantedV3 = Object.values(wanted).includes(w.name);
  if (!isWantedV3 && w.active) {
    await api(`/workflows/${w.id}/deactivate`, 'POST').catch((e) => console.log('deactivate fail', w.name, e.message));
    console.log('Deactivated stale:', w.name);
  }
}

// Inject config values into the Config Set node from local env vars
const configKeys = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GEMINI_API_KEY',
  'YOUTUBE_DATA_API_KEY',
  'FIRECRAWL_API_KEY',
  'NEXT_PUBLIC_SITE_URL',
  'REVALIDATE_SECRET',
];

function injectConfig(wf) {
  for (const node of wf.nodes || []) {
    if (node.name !== 'Config') continue;
    for (const a of node.parameters?.assignments?.assignments || []) {
      const v = process.env[`CFG_${a.name}`];
      if (v !== undefined) a.value = v;
      else if (String(a.value).startsWith('__')) a.value = ''; // leave unset placeholder
    }
  }
  return wf;
}

for (const [file, name] of Object.entries(wanted)) {
  const wf = injectConfig(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')));
  const payload = {
    name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings || {},
  };
  const matches = existing.filter((w) => w.name === name);
  const match = matches.find((w) => w.active) || matches[0];
  // Deactivate duplicate workflows with the same name so only one holds the webhook
  for (const w of matches) {
    if (w.id !== match?.id && w.active) {
      await api(`/workflows/${w.id}/deactivate`, 'POST').catch(() => {});
      console.log('Deactivated duplicate:', name, w.id);
    }
  }
  let id;
  if (match) {
    try {
      const updated = await api(`/workflows/${match.id}`, 'PUT', payload);
      id = updated.id;
      console.log('Updated:', name);
    } catch (e) {
      if (!/archived/i.test(e.message)) throw e;
      const created = await api('/workflows', 'POST', payload);
      id = created.id;
      console.log('Recreated (old was archived):', name);
    }
  } else {
    const created = await api('/workflows', 'POST', payload);
    id = created.id;
    console.log('Created:', name);
  }
  try {
    await api(`/workflows/${id}/activate`, 'POST');
    console.log('Activated:', name);
  } catch (e) {
    console.log('Activate failed for', name, '-', e.message);
  }
}

const after = (await api('/workflows?limit=100')).data || [];
console.log('\nFinal state:');
after.forEach((w) => console.log(` ${w.active ? '[on ]' : '[off]'} ${w.name}`));
