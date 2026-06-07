import fs from 'node:fs';
import path from 'node:path';

/**
 * Local run-artifact helpers (issue #10). Reviewer session output is captured to
 * `.godmode/runs/<run-id>/<reviewer-id>.log` under the **operated project** root
 * (the repo opened in GodMode, never the GodMode app repo). `.godmode/runs/` is
 * gitignored, so these never enter the operated project's history.
 *
 * Kept tiny and dependency-free so the path logic can be unit-tested over a temp
 * dir (mirroring `pty.test.js`); the capture wiring itself lives in
 * `src/main/index.ts`.
 */

/** Project-relative directory holding a run's artifacts. */
export function runArtifactRelDir(runId: string): string {
  return path.posix.join('.godmode', 'runs', runId);
}

/**
 * Resolve and create the absolute artifact directory for a run under the operated
 * project root, returning its absolute path. `mkdir -p` semantics; the run id is
 * treated as a single path segment (it is harness-generated, not user input).
 */
export function ensureRunArtifactDir(projectRoot: string, runId: string): string {
  const dir = path.resolve(projectRoot, '.godmode', 'runs', runId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Absolute path to one reviewer's captured-output log under the operated project. */
export function reviewerArtifactPath(projectRoot: string, runId: string, reviewerId: string): string {
  return path.resolve(projectRoot, '.godmode', 'runs', runId, `${reviewerId}.log`);
}

/**
 * Append captured session output to an artifact file. Best-effort: a write
 * failure (e.g. the dir was removed) never throws into the PTY data callback —
 * capture is auxiliary to the live stream, so a lost write must not crash the
 * session.
 */
export function appendArtifact(absPath: string, data: string): void {
  try {
    fs.appendFileSync(absPath, data);
  } catch {
    // Capture is best-effort; the live stream and PR comment are the contract.
  }
}
