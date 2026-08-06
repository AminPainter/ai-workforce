# Frame → Repo Mapping

Heuristics for mapping a Sentry stack-trace frame's file path to a GlomoPay
GitHub repo and path.

## Repos

- `glomopay_service` -- main backend service (data models, schema, business
  logic, APIs). Default for any frame that isn't clearly frontend.
- `glomopay-checkout` -- frontend. Frames from a browser/JS runtime trace, or
  paths containing `src/components`, `src/pages`, `.tsx`/`.jsx`, or a
  webpack/bundler-style path.
- `api_docs` -- documentation site. Rare in stack traces; only relevant if the
  error originates from doc-site code.
- `kong` -- API-gateway config. Only relevant for gateway-level errors
  (routing, auth-plugin failures), not application exceptions.

## Path cleanup

- Strip any build/bundler prefix before matching against the repo tree (e.g.
  `/app/`, `/dist/`, `webpack-internal:///`, source-map-only paths).
- Backend frames are usually already a real repo-relative path (e.g.
  `src/payments/transfer.service.ts`) -- use as-is against `glomopay_service`.
- If a frame's path doesn't obviously belong to any of the above, say so
  explicitly in the RCA rather than guessing a repo.

## When in doubt

Use `search_code` on the most distinctive part of the frame (a function or
class name, not just the file name) across the candidate repo before falling
back to another repo -- file paths can be ambiguous, symbol names usually
aren't.
