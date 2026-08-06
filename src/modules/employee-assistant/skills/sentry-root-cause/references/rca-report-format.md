# RCA Report Format

Structure every root-cause report exactly like this. Omit a section only if
it's genuinely not applicable (say so, don't leave it blank).

---

**Issue:** [SENTRY-SHORT-ID](sentry-issue-link) -- one-line description of the
error

**Summary:** 1-2 sentences: what's failing and the immediate trigger.

**Root cause:** The specific defect -- a line, a condition, a missing check --
not just "an exception occurred." State confidence (high/medium/low) and why.

**Evidence:**
- Sentry: [SENTRY-SHORT-ID](link) -- what the event/payload showed (masked per
  the masking rule)
- GitHub: [repo/path/to/file.ts#L123](link) -- what the source shows
- GitHub: [PR #456](link) -- the change that introduced or relates to the
  regression, if any

**Suggested fix:** Concrete -- the change you'd make, not "investigate
further" (unless the evidence genuinely runs out, in which case say what's
needed to go further).

**Ticket:** Yes/No -- file a Jira ticket for this? One line on why. If yes and
asked to proceed, use the Jira tools per your main instructions.

---

Keep it plain text / Slack-renderable, matching your normal style rules (no
heavy markdown, IST timestamps, currency explicit if money is involved).
