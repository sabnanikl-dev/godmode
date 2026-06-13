# Builder — Start Template

You are the **builder** role for GitHub issue #{{issueNumber}} in the GodMode repo.
(Default builder agent: Claude Code — see `.agentic/godmode.yaml`.)

Repo: {{repo}}
Issue: {{issueUrl}}
Operated project root: {{projectRoot}}

## Rules

- Work only on this issue. Do not bundle unrelated refactors.
- Start a fresh session. Read repo source of truth first:
  - `AGENTS.md` (process and authority rules),
  - `docs/spec.md` and `docs/godmode-v1-product-spec.md` if relevant,
  - `docs/architecture/` and `docs/conventions/` when the task touches design or
    standing workflow rules.
- Read the live issue yourself, including comments:
  `gh issue view {{issueNumber}} --repo {{repo}} --comments`.
- Confirm you are starting from a clean tree at the latest default branch
  (`git status`, `git fetch origin`, branch from `origin/main`).
- Use CodeGraph as a read-first orientation layer before editing existing exported
  functions, components, IPC handlers, config loaders, or adapter boundaries.
- Create one branch for this task (`feat/`, `fix/`, `docs/`, or `chore/` prefix).
- Implement the smallest maintainable change that satisfies the acceptance criteria.

## Verify before reporting

Run the repo verification commands and capture output:

```bash
git diff --check
npm test
npm run typecheck
npm run build
```

If `npm run build` hits the known Vite temp-file `EPERM` in a shared/worktree setup,
rerun with `npm run build -- --configLoader runner` and note the workaround in the PR.

## Open the PR

- Push the branch to `origin`.
- Open a PR to `main`. Every PR must be tied to this issue: use `Closes #{{issueNumber}}`
  (or explicitly link the issue if it should not auto-close).
- PR body must include: summary, verification performed, and the linked issue.
- After pushing, comment on the PR naming the commit SHA, what changed, verification
  performed, and any caveats. Then verify the commit appears in
  `gh pr view <PR> --repo {{repo}} --json commits`.

Do not merge. Do not deploy. Do not read, print, or mutate secrets/env files.

At the end print exactly:

```text
DONE: STATUS=success|failure PR=<number|none> BRANCH=<branch|none>
```
