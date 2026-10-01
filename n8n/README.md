# n8n Automation Workflows

This folder contains n8n workflow JSON files for the ai-shareplus content engine.

> **Version 2 workflows** include robust error handling, batching, and 4-language summarization/translation (he, en, es, ar).

## Workflows

1. **rss-ingestion.json** (v2) — Polls active RSS sources every 30 minutes, parses items, deduplicates, logs errors per source, and inserts pending articles into Supabase.
2. **youtube-ingestion.json** (v2) — Polls active YouTube channel sources every hour, resolves channel handles/IDs, deduplicates, logs errors, and inserts pending video articles.
3. **ai-processing.json** (v2) — Picks pending articles in batches, extracts text (Jina Reader → Firecrawl fallback), summarizes + translates to all 4 languages in a single Gemini call, inserts translations, publishes, revalidates frontend, and logs each step.

## Required n8n Credentials

In your n8n instance, create these credentials:

- **supabase-service-role** (Supabase API): Use the `service_role` key and project URL.
- **youtube-data-api** (HTTP Header Auth or Query Auth): Only needed if using YouTube Data API v3 directly. The workflow currently reads `YOUTUBE_DATA_API_KEY` from environment variables.

## Required n8n Environment Variables

Set these in n8n → Settings → Variables or via `.env`:

```
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
GEMINI_API_KEY=YOUR_GEMINI_KEY
DEEPL_API_KEY=YOUR_DEEPL_KEY
FIRECRAWL_API_KEY=YOUR_FIRECRAWL_KEY
YOUTUBE_DATA_API_KEY=YOUR_YOUTUBE_KEY
NEXT_PUBLIC_SITE_URL=https://your-vercel-site.com
REVALIDATE_SECRET=YOUR_VERCEL_REVALIDATE_SECRET
```

## Installation Steps

1. Install `rss-parser` in n8n (if the Code node uses `require('rss-parser')`).
   - n8n v1+ uses isolated Docker containers by default, so external packages may not be available in Code nodes. If this fails, split the RSS parsing into an HTTP Request node + XML parse node, or run n8n with `N8N_REOWNED_PACKAGES=rss-parser`.
2. Import each workflow file into n8n (Workflows → Import from File).
3. Connect the Supabase credential to each Supabase node.
4. Activate each workflow.

## Known Limitations

- The v2 workflows use Code nodes for JSON parsing and routing. If you prefer low-code maintenance, consider replacing some Code nodes with native n8n nodes (Loop Over Items, Split In Batches).
- The AI-processing workflow asks Gemini to return all 4 languages in one response. This works well with Gemini 1.5 Flash but verify output quality; you can split to per-language calls if needed.
- YouTube transcript extraction is not fully implemented in the n8n workflow (videos rely on caption availability or third-party transcript services).

## Alternative: Python Worker

If n8n becomes hard to maintain, the same logic can be implemented as a Python worker running on a VPS with `python` + `feedparser` + `youtube-transcript-api` + scheduled via `cron` or `systemd`.
