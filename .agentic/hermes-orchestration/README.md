# Hermes Orchestration Scaffolding

This folder holds **repo-local Hermes orchestration scaffolding** for operating the
GodMode repository through the manual `head → builder → reviewer` loop
(Hermes → Claude Code → Codex reviewers).

## This is not product runtime code

> [!IMPORTANT]
> Everything under `.agentic/hermes-orchestration/` is **operational scaffolding only**.
> It is **not** wired into GodMode product behavior, and nothing in `src/` loads,
> imports, or executes these files.
>
> Do not add product runtime support for loading these templates, a webhook server,
> cron/queue automation, auto-merge, or deploy behavior on the basis of this folder.
> Those would be separate, explicitly scoped GitHub issues.

These assets are prompt templates and checklists that a human operator (or Hermes
acting as the head role) copies/pastes when driving the loop by hand. Treat them the
same way you treat `docs/` — durable guidance, not executable product code.

## Layout

```text
.agentic/hermes-orchestration/
  README.md            # this file
  templates/
    claude-builder-start.md      # builder: start a fresh issue-to-PR session
    claude-builder-fix.md        # builder: address accepted blockers on a PR
    codex-reviewer-start.md      # reviewer: first review of a PR
    codex-reviewer-rereview.md   # reviewer: re-review after fix commits
    hermes-roll-call.md          # head: reconcile active runs against live GitHub state
    verify-pr-ready.md           # head: completion-evidence checklist before handing to Karan
```

## Conventions

These templates are **role-first** and **pointer-first**:

- Role-first — they describe the `head` / `builder` / `reviewer` roles, not specific
  vendors. Hermes, Claude Code, and Codex are today's default agents (see
  `.agentic/godmode.yaml`), but the templates stay agent-agnostic per `AGENTS.md`.
- Pointer-first — they reference live issue/PR URLs, repo docs, and `gh`/`git`
  commands rather than embedding transcripts or stale copies of state. Always read
  the live GitHub surface before acting; agent self-reports are not proof.

## Source of truth

These templates point at, and never override, the repo source of truth:

- `AGENTS.md` — process and authority rules.
- `docs/spec.md`, `docs/godmode-v1-product-spec.md` — product/technical spec.
- `docs/architecture/`, `docs/conventions/` — durable design and standing rules.
- `.agentic/godmode.yaml` — default role/workflow config.
- `docs/review/` — per-reviewer focus docs.
- GitHub Issues/PRs/comments — task and review state.

The broader, repo-independent plan and its source templates live outside this repo at
`/Users/creator/projects/hermes-orchestration/`. This folder is the GodMode-adapted,
repo-local copy.
