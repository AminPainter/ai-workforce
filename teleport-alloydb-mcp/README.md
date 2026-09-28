# Teleport AlloyDB MCP Bridge

Bridges Teleport's `tsh mcp db start` (stdio) to Streamable HTTP, so any
HTTP-based MCP client (e.g. `@ai-sdk/mcp`'s `createMCPClient`) can query
production AlloyDB (read-only) through Teleport without needing the
`tsh`/`tbot` binaries or a Teleport identity of its own.

## How it works

1. `tbot` joins the cluster via `bound_keypair` (static key), writes a
   short-lived identity to `/tmp/teleport-identity`, and keeps renewing it.
2. Once the identity exists, `tsh mcp db start` is launched, wrapped by
   `mcp-proxy`, which exposes it over HTTP on `$PORT` (default 8080) at
   `/mcp`, gated by `X-API-Key`.
3. Callers never see Teleport at all — just an HTTP endpoint + API key.

## Required env vars

| Var | Example | Notes |
|---|---|---|
| `TELEPORT_PROXY` | `teleport.glomopay-eng.com:443` | default already set |
| `TELEPORT_TOKEN` | `render-agent` | the bound_keypair provision token name |
| `TELEPORT_DB_URI` | `teleport://clusters/prod-teleport/databases/alloydb-production?dbName=glomopay_service&dbUser=teleport-token-v2@glomopay-production.iam` | required |
| `MCP_PROXY_API_KEY` | (generate a random secret) | required — this is what the calling app sends as `X-API-Key` |
| `TBOT_BOUND_KEYPAIR_STATIC_KEY` | base64 of the private key `.pem` | required — Teleport identity, provided out-of-band |
| `PORT` | `8080` | Render sets this automatically |

## Deploy on Render

- New Web Service, Docker runtime, this repo/Dockerfile.
- Region: same as the main app (Singapore) for lowest latency, though not required.
- Health check path: none needed to hit `/mcp` (POST only) — use `/` or disable.
- Set all env vars above via Render's dashboard secrets (`sync: false` equivalent).

## Calling it from the main app (ai-workforce)

```ts
createMCPClient({
  transport: {
    type: 'http',
    url: 'https://<this-service>.onrender.com/mcp',
    headers: { 'X-API-Key': process.env.ALLOYDB_MCP_API_KEY },
  },
})
```

Exposes exactly two tools: `teleport_list_databases`, `teleport_postgres_query`
(read-only, enforced by the `alloydb-production-readonly` Teleport role, not
by this bridge — do not rely on this service alone for access control).
