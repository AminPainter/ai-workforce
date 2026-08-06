---
name: sentry-root-cause
description: >-
  Root-cause analysis workflow for a Sentry issue: maps stack frames to GitHub
  source, checks recent changes for regressions, and produces a structured RCA
  report. Use when asked to investigate, debug, or find the root cause of a
  Sentry issue, error, or crash (e.g. "root cause SENTRY-123", "why is this
  erroring", "investigate this crash").
---

# Sentry Root-Cause Analysis

A codified workflow for investigating a Sentry issue down to a grounded root
cause. Use the Sentry and GitHub tools already available to you -- this skill
only tells you how to sequence them and what a good RCA looks like.

## Workflow

1. **Resolve the issue.** If no Sentry org is given, default to the
   `SENTRY_ORG` env value. Use `search_issues` / `find_projects` to locate the
   issue, then pull its latest event via `search_events` / `get_sentry_resource`.
   Extract the exception type, message, and full stack trace (all frames, not
   just the top one).

2. **Map frames to source.** Convert each relevant stack frame's file path
   into a repo + file path using `references/frame-mapping.md`. Default repo
   is `glomopay_service`; use `glomopay-checkout` for frontend/browser frames.
   Read the actual file on GitHub with `get_file_contents` -- never reason
   about the bug from the stack-trace text alone. Read enough surrounding
   context (the function, its callers) to understand the logic, not just the
   failing line.

3. **Check for a regression.** Look at recent history around the failing
   lines: `list_commits` / `get_commit` for that file, `search_pull_requests` /
   `get_pull_request_diff` for PRs that touched it. A recent change that lines
   up with when the issue started firing is the strongest signal.

4. **Form a hypothesis.** State it plainly, state your confidence, and
   separate evidence (the event payload, the source you read, a specific
   commit/PR) from inference (your read on why the code behaves that way). If
   the evidence doesn't support a confident root cause, say so -- don't force
   one.

5. **Write the report.** Use the exact structure in
   `references/rca-report-format.md`. Always include: the Sentry issue
   short-id and link, the GitHub file/PR links you used as evidence, the
   suggested fix, and a one-line call on whether this warrants a Jira ticket
   (offer to create one -- see the Jira tools in your main instructions).

## Masking rule (org policy)

Sentry event payloads and source files can carry secrets, tokens, and customer
PII. Never paste full API keys/tokens, full PANs, full bank account numbers,
or full customer email/phone into the report. Mask them
(`XXXX-XXXX-XXXX-1234`, `••••1234`, `j•••@domain`) and summarize instead of
quoting raw payloads.

## Reference files

- `references/frame-mapping.md` -- path-to-repo heuristics.
- `references/rca-report-format.md` -- the exact report template.

Load either with `readSkillReference` before you need it -- don't guess the
format.
