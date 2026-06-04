# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

GodMode is a local, macOS-first, tmux-style **bring-your-own-agent** coding dashboard built with Electron. It runs role-bound CLI agents in live terminal panes and is meant to drive an automatic build → review → fix PR loop while keeping final merge authority with the human. The current code is an early scaffold: a static dashboard plus working PTY-backed terminal panes. The full PR-automation loop is not implemented yet (the `RunStatus` machine in `src/shared/types.ts` defines the intended states).

## Authority / Source of Truth

`AGENTS.md` is the operating contract for this repo and **overrides ad-hoc instructions**. Before inventing behavior, consult, in order: `AGENTS.md`, `docs/spec.md`, `docs/godmode-v1-product-spec.md`, `.agentic/godmode.yaml`, then GitHub issues/PRs, then `docs/friction/`. Durable rules belong in these docs, not in one-off prompts. Key process rules that affect any change here:

- Never push to `main`; one branch per task (`feat/`, `fix/`, `docs/`, `chore/`). No auto-merge in v1.
- After pushing a commit to a PR branch, leave a PR comment naming the commit, what changed, and verification performed — then confirm the commit appears in `gh pr view <PR> --json commits` before reporting done. Agent self-reports are not proof; verify with `git`/`gh`.
- Update docs in the same PR when behavior, architecture, setup, or harness rules change.

## Commands

```bash
npm install
npm run typecheck      # type-checks BOTH tsconfigs (renderer + main); run this as the primary gate
npm run build          # typecheck + compile main + vite build
npm run build:main     # compile main/preload/shared to dist/ (tsc -p tsconfig.main.json)
npm run electron:dev   # build:main, start vite, then launch Electron against the dev server
npm run dev            # vite renderer only (no Electron, window.godmode API absent)
```

There is **no test suite yet**. `npm run typecheck` and `npm run build` are the verification commands — keep `AGENTS.md`'s "Verification Commands" section in sync when that changes.

## Architecture

### Two separate TypeScript build targets

This is the most important structural fact. The codebase is split across two tsconfigs that must not be conflated:

- `tsconfig.json` — renderer (`src/renderer`, `src/shared`). `moduleResolution: Bundler`, JSX, DOM libs, `noEmit` (Vite handles bundling).
- `tsconfig.main.json` — Electron main process (`src/main`, `src/preload`, `src/shared`, `src/core`). `module/moduleResolution: NodeNext`, emits to `dist/`.

Because the main side is ESM + NodeNext, **relative imports must use explicit `.js` extensions even from `.ts`/`.tsx` source** (e.g. `App.tsx` imports `./components/AgentPane.js`, main imports `./pty.js`). Omitting the extension breaks the build.

### Electron three-layer boundary

```
src/main/      Node process: window lifecycle, node-pty sessions, IPC handlers
src/preload/   contextBridge: the ONLY bridge between main and renderer
src/renderer/  React + Vite UI, xterm.js terminals; reaches main via window.godmode
src/shared/    types shared across all layers (AgentRole, RunStatus, etc.)
src/core/      reserved for role/adapter logic (referenced by tsconfig, not yet present)
```

- The renderer never touches Node directly. `src/preload/index.ts` exposes a typed `window.godmode` API (`GodModeApi`) via `contextBridge` (`contextIsolation: true`, `nodeIntegration: false`). Add new main↔renderer capabilities by: defining the IPC channel + zod schema in `src/main/index.ts`, adding the method in the preload bridge, and consuming it through `window.godmode` in the renderer.
- All IPC payloads from the renderer are validated with **zod** in `src/main/index.ts`; invalid payloads are logged and dropped, never thrown to the renderer. Preserve this — never trust renderer input in main.
- IPC channels are namespaced `godmode:pty:*`.

### PTY sessions (`src/main/pty.ts`)

One PTY per pane, keyed by `paneId`, restricted to the four role panes: `head`, `builder`, `reviewer_a`, `reviewer_b` (this allowlist appears both in `pty.ts` and the zod enum in `index.ts` — keep them aligned). Opening a pane that already has a session kills the old one. Sessions are spawned with a hardcoded env **allowlist** (`buildSafeEnv`) — do not pass the full `process.env`. Sessions are cleaned up on window destroy/navigation, `before-quit`, and `window-all-closed`. The dev-server URL is validated against localhost before a PTY-enabled renderer loads it.

### Roles vs agents (BYOA invariant)

Core abstractions are keyed by **generic roles** (`head` | `builder` | `reviewer_a` | `reviewer_b` from `src/shared/types.ts`), never by concrete agent names. "Hermes", "Claude Code", "Codex" are display labels and config defaults in `.agentic/godmode.yaml` only. Do not name core abstractions `HermesPane`/`ClaudePane`/`CodexPane`, and do not hardcode the default stack into logic — agents, capabilities, and role bindings are modeled separately (`AgentDefinition`, `AgentCapabilities`, `RoleBinding`). Adapters are capability-based and small. The PR-loop workflow should use deterministic state transitions (`RunStatus`), not LLM output alone.

## Friction Log

When something non-obvious breaks, add a short note to `docs/friction/` (what happened, root cause, fix, whether `AGENTS.md`/`docs/spec.md`/config should change).
