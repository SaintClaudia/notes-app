# notes-summary-proxy

Cloudflare Worker that proxies AI dashboard summaries to Anthropic. The Anthropic API key lives only here — the app never sees it.

## One-time setup

```bash
cd worker
npm install
npx wrangler login

# Create the KV namespace used for per-device rate limiting, then
# paste the returned id into wrangler.toml (REPLACE_WITH_KV_NAMESPACE_ID)
npx wrangler kv:namespace create RATE_LIMIT_KV

# Store the real Anthropic key as a secret (never committed to git)
npx wrangler secret put ANTHROPIC_API_KEY
```

## Local dev

```bash
npm run dev
```

## Deploy

```bash
npm run deploy
```

Note the deployed URL (e.g. `https://notes-summary-proxy.<your-subdomain>.workers.dev`) — it goes into the app's `SUMMARY_PROXY_URL` in `src/app.jsx`.
