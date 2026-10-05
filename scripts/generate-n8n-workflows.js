const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'n8n', 'workflows');
const codeDir = path.join(root, 'n8n', 'workflow-code');
const shared = fs.readFileSync(path.join(codeDir, 'shared.js'), 'utf8');

function workflow(name, intervalUnit, interval, code, webhookPath) {
  return {
    name,
    nodes: [
      {
        parameters: { rule: { interval: [{ field: intervalUnit, [`${intervalUnit}Interval`]: interval }] } },
        id: `${webhookPath}-schedule`,
        name: 'Schedule',
        type: 'n8n-nodes-base.scheduleTrigger',
        typeVersion: 1,
        position: [250, 300],
      },
      {
        parameters: { path: webhookPath, httpMethod: 'POST', responseMode: 'lastNode', options: {} },
        id: `${webhookPath}-webhook`,
        name: 'Manual Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 2,
        position: [250, 500],
      },
      {
        parameters: {
          assignments: {
            assignments: [
              'SUPABASE_URL',
              'SUPABASE_SERVICE_ROLE_KEY',
              'GEMINI_API_KEY',
              'YOUTUBE_DATA_API_KEY',
              'FIRECRAWL_API_KEY',
              'NEXT_PUBLIC_SITE_URL',
              'REVALIDATE_SECRET',
            ].map((name, i) => ({ id: `cfg-${i}`, name, value: `__${name}__`, type: 'string' })),
          },
          options: {},
        },
        id: `${webhookPath}-config`,
        name: 'Config',
        type: 'n8n-nodes-base.set',
        typeVersion: 3.4,
        position: [400, 400],
      },
      {
        parameters: { jsCode: `${shared}\n\n${code}` },
        id: `${webhookPath}-code`,
        name: 'Run Pipeline',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [650, 400],
      },
    ],
    connections: {
      Schedule: { main: [[{ node: 'Config', type: 'main', index: 0 }]] },
      'Manual Webhook': { main: [[{ node: 'Config', type: 'main', index: 0 }]] },
      Config: { main: [[{ node: 'Run Pipeline', type: 'main', index: 0 }]] },
    },
    settings: { executionOrder: 'v1' },
    staticData: null,
    tags: [],
  };
}

const files = [
  ['rss-ingestion-v3.json', workflow('ai-shareplus: RSS Ingestion (v3)', 'minutes', 30, fs.readFileSync(path.join(codeDir, 'rss.js'), 'utf8'), 'shareplus-rss-v3')],
  ['youtube-ingestion-v3.json', workflow('ai-shareplus: YouTube Ingestion (v3)', 'hours', 1, fs.readFileSync(path.join(codeDir, 'youtube.js'), 'utf8'), 'shareplus-youtube-v3')],
  ['ai-processing-v3.json', workflow('ai-shareplus: AI Summarize & Translate (v3)', 'minutes', 5, fs.readFileSync(path.join(codeDir, 'ai.js'), 'utf8'), 'shareplus-ai-v3')],
];

for (const [file, data] of files) {
  fs.writeFileSync(path.join(outDir, file), `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Generated ${file}`);
}
