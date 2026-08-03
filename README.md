# GlomoPay employee-assistant

A NestJS Slack bot that answers employee questions using an LLM (via an OpenAI-compatible
AI gateway), web search (SearXNG), and read-only MCP tools (GitHub, Atlassian/Jira, Sentry).

The app and SearXNG ship in a single Docker image: SearXNG runs on `127.0.0.1:8080` inside the
container and the app talks to it there. One container runs both processes.

## Run locally (Docker)

Prereqs: Docker + Docker Compose. (Node 22 / pnpm 10 only needed for non-Docker dev.)

```bash
cp .env.example .env      # then fill in the values below, INCLUDING SEARXNG_SECRET
pnpm docker:up            # docker compose up --build
```

- App: http://localhost:51515 (`GET /` returns a hello string — also the health check path)
- SearXNG JSON API: http://localhost:8080/search?q=test&format=json (exposed for debugging only)

Stop with `pnpm docker:down`.

`docker-compose.yml` bind-mounts `searxng/settings.yml` read-only, so you can edit SearXNG
config and restart without rebuilding.

## Environment variables

Set these in `.env` locally and as `sync: false` dashboard values on Render.

AI gateway (required):
- `AI_GATEWAY_API_KEY`
- `AI_GATEWAY_BASE_URL`
- `AI_GATEWAY_MODEL`

Slack (required — the bot receives events via webhooks, so the service must be public):
- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`
- `SLACK_APP_TOKEN`, `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` — only if your Slack app config needs them

MCP tools (read-only integrations):
- `GITHUB_PAT` (+ optional `GITHUB_MCP_URL`)
- `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN` (+ optional `ATLASSIAN_MCP_URL`)
- `SENTRY_AUTH_TOKEN` (+ optional `SENTRY_MCP_URL`)

Contract drift detector (GitHub push webhook → `POST /webhooks/github`):
- `GITHUB_WEBHOOK_SECRET` (required) — the shared secret configured on the `glomopay_service`
  repo webhook; used to verify the `X-Hub-Signature-256` HMAC. Configure the webhook for the
  `push` event only, content type `application/json`, URL `https://<host>/webhooks/github`.
- `GITHUB_WEBHOOK_REPOS` (optional) — comma-separated `owner/repo` allowlist. If unset, any
  repo passing signature verification is accepted. The agent only runs on pushes to
  `refs/heads/main` and logs a drift report to the console.
- `CONTRACT_DRIFT_MAX_STEPS` (optional, default 30) — tool-loop step cap for the agent.

The webhook does not run the agent inline. After signature verification and the
`refs/heads/main` + repo-allowlist filters, `POST /webhooks/github` enqueues the verified
payload onto the `contract-drift` BullMQ queue and immediately returns `200 {"ok":true}`; an
in-process worker (same web service) runs the agent and logs the report. Jobs are keyed on
`X-GitHub-Delivery` (`jobId`), so GitHub redeliveries are deduped while the completed job is
retained. Retries: 3 attempts with exponential backoff.

Queue infra (`src/modules/queue`, shared by any future webhook consumer):
- `REDIS_URL` (required) — now load-bearing for the queue as well as Chat SDK state; BullMQ
  opens its own connection to it.
- `QUEUE_JOB_ATTEMPTS` (optional, default 3) — retry attempts per job.
- `QUEUE_BACKOFF_MS` (optional, default 5000) — exponential backoff base delay.
- `CONTRACT_DRIFT_CONCURRENCY` (optional, default 1) — worker concurrency for the
  `contract-drift` queue (read from `process.env` at module load — the `@Processor`
  concurrency option is decorator-time).

RAG / Legal Assistant (Postgres + pgvector — grounds the `legal-assistant` agent):
- `DATABASE_URL` (required) — Postgres connection string. Local: `postgres://rag:rag@localhost:5432/rag`
  (the `postgres` service in `docker-compose.yml`). Render: wired from the managed Postgres in
  `render.yaml`. The DB needs the `vector` extension — the migration runs `CREATE EXTENSION vector`.
- `AI_GATEWAY_EMBEDDING_MODEL` (required for RAG) — embedding model id on the AI gateway. Only
  loaded when embeddings are actually used (ingest / retrieval), so the rest of the app boots
  without it.
- `RAG_EMBEDDING_DIMENSIONS` (required for RAG) — the embedding vector length. Must equal the
  model's output dimension; it fixes the pgvector column and cannot change without a re-index +
  re-ingest. Get it once from the Step 0 probe (see "Legal knowledge base" below).
- `RAG_RETRIEVAL_TOP_K` (optional, default 5) — excerpts returned per search.
- `RAG_MIN_SIMILARITY` (optional) — drop excerpts below this cosine similarity (0–1). Unset = keep top-k.
- `RAG_CHUNK_CHARS` (optional, default 1800) / `RAG_CHUNK_OVERLAP` (optional, default 300) — ingest chunking.
- `RAG_EMBEDDING_BATCH_SIZE` (optional, default 96) — inputs per `embedMany` call during ingest.
- `LEGAL_ASSISTANT_MAX_STEPS` (optional, default 20) — tool-loop step cap for the agent.

SearXNG:
- `SEARXNG_SECRET` (required) — SearXNG reads this natively and overrides `secret_key`. If it is
  unset in production, SearXNG's boot guard exits with an error rather than running with a weak
  secret, so it must be set.
- `SEARXNG_BASE_URL` — full URL to the in-container SearXNG. Always `http://127.0.0.1:8080`
  (set by compose and render.yaml; you don't set it in `.env`).

`PORT` is injected by the platform (Render) and set to `51515` locally by compose — do not
hardcode it in code.

Note: `REDIS_HOST` / `REDIS_PORT` are no longer used — the app connects via `REDIS_URL`
(both the Chat SDK state and the BullMQ queue). Leftover `REDIS_HOST` / `REDIS_PORT` values in
`.env` are harmless.

## Deploy to Render

The repo ships a `render.yaml` blueprint: one public Docker web service in Singapore
(`starter` plan, kept warm for Slack webhooks), running both the app and SearXNG.

1. Push this repo to GitHub.
2. In Render: New → Blueprint, connect the repo. Render reads `render.yaml`.
3. At first sync, fill every `sync: false` secret — including `SEARXNG_SECRET`.
4. Deploy. Confirm `/` health passes, then mention the bot in Slack and verify a
   web-search-backed answer (proves the in-container SearXNG on `127.0.0.1:8080` works).

## Legal knowledge base (RAG)

The `legal-assistant` agent answers only from ingested legal PDFs, retrieved from Postgres/pgvector
and cited by source + page. The `employee-assistant` delegates legal-document questions to it via the
`askLegalAssistant` tool. Ingestion is a manual CLI; the store is collection-partitioned
(`legal` today, e.g. `sales` later with no schema change).

Step 0 — confirm the embedding path and capture the dimension (do this first):

```bash
pnpm repl
# in the REPL:
const ai = await get(AiService)
const { embed } = await import('ai')
const { embedding } = await embed({ model: ai.embeddingModel(), value: 'ping' })
embedding.length   // → set RAG_EMBEDDING_DIMENSIONS to this
```

If the gateway serves no embeddings endpoint, add `@ai-sdk/openai` and point `AiService.embeddingModel()`
at `openai.textEmbedding('text-embedding-3-small')` (1536-dim, needs `OPENAI_API_KEY`); nothing else changes.

Then migrate and ingest (both read `.env` via `--env-file-if-exists`):

```bash
pnpm db:migrate                                              # creates rag_document / rag_chunk + HNSW index
pnpm ingest -- --collection legal --dir ./knowledge/legal    # parse → chunk → embed → upsert (idempotent)
```

Re-running `ingest` is idempotent (skips unchanged files by sha256 checksum, re-chunks changed ones).

## Non-Docker dev

```bash
pnpm install
pnpm run start:dev
```

You'll need a SearXNG reachable at `SEARXNG_BASE_URL` and all env vars above set in your shell
or `.env`.

## Tests

```bash
pnpm test         # unit
pnpm test:e2e     # e2e
pnpm test:cov     # coverage
```
