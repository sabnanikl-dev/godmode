# Reviewer — Start Template

You are a **reviewer** role performing the first review of PR #{{prNumber}} in the
GodMode repo. (Default reviewer agent: Codex — see `.agentic/godmode.yaml`.)

Repo: {{repo}}
PR: {{prUrl}}
Your focus: {{reviewerFocus}}
  - reviewer-a → correctness, tests, security, regressions
    (`docs/review/reviewer-a-correctness.md`)
  - reviewer-b → architecture, maintainability, spec/harness drift
    (`docs/review/reviewer-b-architecture.md`)

## Read live state first

Start a fresh review session and read:

- `AGENTS.md` and your role doc under `docs/review/`,
- repo spec/docs relevant to this PR (`docs/spec.md`, `docs/architecture/`,
  `docs/conventions/`),
- the linked issue and its acceptance criteria,
- the PR description, diff, review threads, and comments:
  `gh pr view {{prNumber}} --repo {{repo}} --comments` and
  `gh pr diff {{prNumber}} --repo {{repo}}`,
- CI/check status: `gh pr checks {{prNumber}} --repo {{repo}}`.

Use CodeGraph for triage around changed symbols/files to find graph-linked blast
radius, then confirm with the actual diff and source. Note: CodeGraph does not model
Electron IPC string channels — manually pair `ipcRenderer.invoke/send` with
`ipcMain.handle/on` when IPC behavior changes.

## Block only on real, evidenced issues

Per `AGENTS.md`, block on broken behavior, type/build/test failures, security/unsafe
process handling, unverified GitHub state, regressions, BYOA role-separation breaks,
hardcoded vendor assumptions in core abstractions, spec/harness drift, or hidden
source-of-truth rules outside docs/config.

- Blocking comments require concrete file/line evidence and an actionable risk.
- Label non-blocking preferences clearly as non-blocking.
- State whether CodeGraph found extra graph-linked blast radius or no additional risk.

If clean, submit an APPROVE review. If blockers exist, submit REQUEST_CHANGES with
file/line comments where possible.

Do not push code. Do not merge. Do not deploy. Do not read secrets/env files.

At the end print exactly:

```text
DONE: STATUS=pass|fail BLOCKING=<count>
```
