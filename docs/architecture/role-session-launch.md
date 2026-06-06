# Role Session Launch

GodMode launches a configured agent per role pane through `node-pty`, under
strict project-directory and environment controls. This is the step after the
adapter registry (issue #5): the registry *describes* roles/agents; this wiring
*launches* them (issue #6). Core code stays role- and capability-driven — it
never branches on a specific vendor.

## Boundaries

| Concern | Owner |
| --- | --- |
| Map a pane/role → its launchable agent command | `resolveRoleLaunch` in `src/main/agents.ts` |
| Resolve the executable, restrict cwd/env, spawn/track the PTY | `src/main/pty.ts` |
| IPC: resolve role, then open the session | `godmode:pty:start` in `src/main/index.ts` |
| Start/restart/stop controls + visible launch errors | `src/renderer/components/AgentPane.tsx` |

## Role → command mapping

`resolveRoleLaunch(paneId)` loads the same project config the registry uses and
returns either `{ ok: true, spec }` with the bound agent's `command`, or
`{ ok: false, error }` with a human-readable reason. Like the registry, it falls
back to safe defaults when the config file is missing/invalid, so a broken file
never blocks the shipped default agents. It rejects, with a visible reason:

- a role with no bound agent (e.g. an unconfigured `reviewer_b`), and
- a non-`cli` adapter — only `cli` is launch-wired in v1; `mcp`/`acp`/`custom`
  resolve to a descriptive error rather than a silent no-op.

Unknown pane/role *ids* are rejected twice in the main process: by the Zod enum
on the IPC payload and again by the allow-list guard in `openPtySession`.

## Safe launch

`openPtySession` enforces the AGENTS.md safety constraints before spawning:

- **cwd** is the resolved selected operated-project root, confirmed to be a
  readable directory — never the GodMode app repo, never `process.cwd()`.
- **env** is the sanitized minimal allow-list (`buildSafeEnv`), unchanged from
  the prior shell behavior.
- **executable** is resolved up front via `resolveExecutable`: a bare command is
  searched on the safe `PATH`; a path-bearing command is resolved against the
  project root and must be an executable file. An unresolvable command returns a
  visible `Command not found` error **without spawning**, so failure does not
  depend on node-pty's exec-failure behavior. The existing session is only torn
  down once the new command is known good, so a restart with a now-broken command
  leaves the running session in place.

The command string is split on whitespace (executable + args); quoting is out of
scope for v1, which keeps smoke testing simple (`node --version`, `zsh`).

## Errors, controls, lifecycle

`godmode:pty:start` returns a `PtyStartResult` (`{ ok: true, pid }` or
`{ ok: false, error }`) instead of throwing across IPC. The pane writes any
`error` into its own xterm buffer (`[launch error: …]`) — errors appear inside
the relevant pane, not as a generic app alert.

Each pane exposes **start / restart / stop**. Restart reuses start because
`openPtySession` replaces any live session for the pane (killing the old one
without firing its renderer exit, since the exit handler checks identity).

Sessions are cleaned up on UI stop, renderer teardown (the start handler binds
`destroyed`/`did-start-navigation` on the sender; the pane stops on unmount), and
app quit (`before-quit` / `window-all-closed` call `killAllPtySessions`).
Switching the operated project also tears down live sessions so a terminal never
outlives the project it was spawned in.

## Tests

`test/pty.test.js` covers `resolveRoleLaunch` (builder mapping, default
fallback, non-cli rejection, unconfigured reviewer) and `resolveExecutable`
(PATH hit, missing command, project-relative executable). Pure functions over a
temp dir and `PATH` — no Electron and no real spawn. Run with `npm test`.
