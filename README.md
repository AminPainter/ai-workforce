# GlomoPay employee-assistant

A NestJS Slack bot that answers employee questions using an LLM (via an OpenAI-compatible
AI gateway), web search (SearXNG), and read-only MCP tools (GitHub, Atlassian/Jira, Sentry).

SearXNG runs as its own container (`searxng/Dockerfile`, pinned upstream image + our
`settings.yml`) and the app reaches it over the network at `SEARXNG_BASE_URL`. Only
`SEARXNG_SECRET` is passed to SearXNG; it never sees the app's secrets.

## Run locally (Docker)

Prereqs: Docker + Docker Compose. (Node 22 / pnpm 10 only needed for non-Docker dev.)

```bash
cp .env.example .env      # then fill in the values below, INCLUDING SEARXNG_SECRET
pnpm docker:up            # docker compose up --build
```

- App: http://localhost:51515 (`GET /` returns a hello string — also the health check path)
- SearXNG JSON API: http://localhost:8080/search?q=test&format=json (exposed for debugging only)

Stop with `pnpm docker:down`.

`docker-compose.yml` bind-mounts `searxng/settings.yml` read-only into the `searxng` container,
so you can edit SearXNG config and `docker compose restart searxng` without rebuilding.

## Environment variables

Set these in `.env` locally and as `sync: false` dashboard values on Render.

AI gateway (required):
- `AI_GATEWAY_API_KEY`
- `AI_GATEWAY_BASE_URL`

Slack (required — the bot receives events via webhooks, so the service must be public):
- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`
- `SLACK_APP_TOKEN`, `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` — only if your Slack app config needs them

GitHub App (required — every GitHub call, MCP, Octokit and git push, uses its installation tokens):
- `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`
- `GITHUB_APP_PRIVATE_KEY` — the PEM; `\n`-escaped single-line values work too
- Repository permissions: Contents and Pull requests read/write, Issues and Metadata read. Install
  it on every repo the agents touch (at least `glomopay/glomopay_service` and `glomopay/kong`).

MCP tools (read-only integrations):
- optional `GITHUB_MCP_URL`
- `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN` (+ optional `ATLASSIAN_MCP_URL`)
- `SENTRY_AUTH_TOKEN` (+ optional `SENTRY_MCP_URL`)

GitHub webhook (`POST /webhooks/github`, `src/modules/github`):
- `GITHUB_WEBHOOK_SECRET` (required) — shared secret used to verify the `X-Hub-Signature-256`
  HMAC. Merged PRs into `main` are emitted as the `github.pull_request.merged_to_main` event.

Queue infra (`src/modules/queue`):
- `REDIS_URL` (required) — now load-bearing for the queue as well as Chat SDK state; BullMQ
  opens its own connection to it.
- `QUEUE_JOB_ATTEMPTS` (optional, default 3) — retry attempts per job.
- `QUEUE_BACKOFF_MS` (optional, default 5000) — exponential backoff base delay.

Database (`src/modules/prisma`):
- `DATABASE_URL` (required) — Postgres connection string. Compose sets it for the `postgres`
  container; on Render it comes from the `glomo-ai-workforce-db` database (internal URL). For
  non-Docker dev against the compose database use
  `postgresql://ai_workforce:ai_workforce@localhost:5432/ai_workforce`.

Kong route sync (`src/modules/kong-route-sync`): when a `glomopay_service` PR merges to main
and touches `config/routes.rb` or `config/routes/**/*.rb` (checked deterministically against the
PR's file list), the coding-agent worker mirrors the route changes into `glomopay/kong`, opens a
draft PR on `amin-ka-bot/sync-routes-glomopay-pr-<N>` and DMs the PR author. Rides on the GitHub
`pull_request` webhook above.
- `KONG_ROUTE_SYNC_AUTHOR_DENYLIST` (optional) — comma-separated GitHub usernames to skip, e.g.
  `dependabot[bot]`.
- The GitHub App needs Contents + Pull requests read/write on `glomopay/kong`. The main Slack app
  needs `chat:write`, `users:read.email` and `im:write`.

Leave bot (#leaves → RazorpayX Payroll attendance, `src/modules/leave-tracker`):
The leave bot runs as its own Slack app, separate from the main bot, with its own Chat
instance (Redis key prefix `chat-sdk-leaves`). Point that app's Event Subscriptions request URL
at `https://<host>/webhooks/slack/leaves`.
- `LEAVES_SLACK_CHANNEL` (optional) — #leaves channel id. Unset disables the bot. The leaves
  Slack app needs `chat:write`, `users:read`, `users:read.email`, `reactions:write`,
  `channels:history` and the `message.channels` event (plus `app_mentions:read` / `app_mention`
  for mentions), and must be a member of the channel.
- `LEAVES_SLACK_BOT_TOKEN` (required when `LEAVES_SLACK_CHANNEL` is set) — the leaves app's
  `xoxb-` bot token.
- `LEAVES_SLACK_SIGNING_SECRET` (required when `LEAVES_SLACK_CHANNEL` is set) — the leaves
  app's signing secret.
- `LEAVES_PEOPLE_PARTNER_SLACK_USER_ID` (required) — Slack user id tagged on failures.
- `RAZORPAYX_PAYROLL_COMPANIES` (required for the bot to write) — JSON array
  `[{"id": 337931, "key": "..."}, {"id": 337936, "key": "..."}]`, one per payroll company
  (337931 Glomopay Software, 337936 Glomo Payments IFSC). Leave-type codes per company live in
  `leave-tracker/constants/leave-kinds.ts`; a company without codes there fails its writes
  loudly.

`pnpm leaves:repl` runs the classifier golden set.

SearXNG:
- `SEARXNG_SECRET` (required, SearXNG service only) — SearXNG reads this natively and overrides
  `secret_key`. If it is unset, SearXNG's boot guard exits with an error rather than running with
  a weak secret. Locally compose reads it from `.env` and passes only this var to the `searxng`
  container; on Render it is set on the `glomo-ai-workforce-searxng` private service.
- `SEARXNG_BASE_URL` (app) — full URL to SearXNG. `http://searxng:8080` under compose,
  `http://glomo-ai-workforce-searxng:8080` on Render (both set for you; you don't set it in
  `.env`).

`PORT` is injected by the platform (Render) and set to `51515` locally by compose — do not
hardcode it in code.

Note: `REDIS_HOST` / `REDIS_PORT` are no longer used — the app connects via `REDIS_URL`
(both the Chat SDK state and the BullMQ queue). Leftover `REDIS_HOST` / `REDIS_PORT` values in
`.env` are harmless.

## Deploy to Render

The repo ships a `render.yaml` blueprint in Singapore: the public app web service (`starter`
plan, kept warm for Slack webhooks), and SearXNG as a private service
(`glomo-ai-workforce-searxng`, reachable only on Render's private network). SearXNG redeploys only
when `searxng/**` changes.

It also creates a private Postgres instance (`glomo-ai-workforce-db`). The web service's
`preDeployCommand` runs `prisma migrate deploy` against it before each deploy goes live; a failed
migration fails the deploy.

1. Push this repo to GitHub.
2. In Render: New → Blueprint, connect the repo. Render reads `render.yaml`.
3. At first sync, fill every `sync: false` secret — including `SEARXNG_SECRET` on the SearXNG
   service.
4. Deploy. Confirm `/` health passes, then mention the bot in Slack and verify a
   web-search-backed answer (proves the app reaches the SearXNG private service).

## Non-Docker dev

```bash
pnpm install
pnpm db:generate          # Prisma client → src/generated/prisma (gitignored)
pnpm run start:dev
```

You'll need a SearXNG reachable at `SEARXNG_BASE_URL` and all env vars above set in your shell
or `.env`.

## Database (Prisma)

Prisma ORM 7 with the `pg` driver adapter. `PrismaModule` is global, so inject
`PrismaService` anywhere.

- Prisma is pinned to 7.x: npm's `latest` tag for `prisma` is a Prisma 8 pre-release that has
  no `migrate` / `generate`. Don't bump with `@latest`.
- `prisma/schema.prisma` holds the models; `prisma.config.ts` holds the connection URL.
- After pulling schema changes: `pnpm db:generate`. `pnpm build` regenerates automatically.
- New migration: edit the schema, then `pnpm db:migrate --name <change>` (needs a dev database,
  e.g. `docker compose up -d postgres`). Commit `prisma/migrations/**`.
- Production applies migrations via Render's pre-deploy (`pnpm db:deploy` locally does the same).

## Tests

```bash
pnpm test         # unit
pnpm test:e2e     # e2e
pnpm test:cov     # coverage
```
