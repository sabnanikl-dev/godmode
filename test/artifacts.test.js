// Run-artifact path/capture tests for issue #10. Pure path logic plus a small
// filesystem helper over a temp dir (mirroring `pty.test.js`) — no Electron. Run
// against the compiled main output (`npm run build:main` first) via `npm test`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  appendArtifact,
  ensureRunArtifactDir,
  reviewerArtifactPath,
  runArtifactRelDir,
} from '../dist/main/artifacts.js';

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'godmode-artifacts-'));
}

test('runArtifactRelDir is the gitignored project-relative run dir', () => {
  assert.equal(runArtifactRelDir('run-10'), '.godmode/runs/run-10');
});

test('ensureRunArtifactDir creates the absolute run dir under the operated project', () => {
  const root = tempRoot();
  const dir = ensureRunArtifactDir(root, 'run-10');
  assert.equal(dir, path.resolve(root, '.godmode', 'runs', 'run-10'));
  assert.ok(fs.statSync(dir).isDirectory());
  // Idempotent: a second call on an existing dir does not throw.
  assert.doesNotThrow(() => ensureRunArtifactDir(root, 'run-10'));
});

test('reviewerArtifactPath resolves one reviewer log under the run dir', () => {
  const root = tempRoot();
  const file = reviewerArtifactPath(root, 'run-10', 'reviewer-a');
  assert.equal(file, path.resolve(root, '.godmode', 'runs', 'run-10', 'reviewer-a.log'));
});

test('appendArtifact accumulates captured output across calls', () => {
  const root = tempRoot();
  ensureRunArtifactDir(root, 'run-10');
  const file = reviewerArtifactPath(root, 'run-10', 'reviewer-a');
  appendArtifact(file, 'first chunk\n');
  appendArtifact(file, 'second chunk\n');
  assert.equal(fs.readFileSync(file, 'utf8'), 'first chunk\nsecond chunk\n');
});

test('appendArtifact never throws when the target dir is missing (capture is best-effort)', () => {
  const root = tempRoot();
  // No ensureRunArtifactDir — the parent dir does not exist.
  const file = reviewerArtifactPath(root, 'missing-run', 'reviewer-a');
  assert.doesNotThrow(() => appendArtifact(file, 'dropped\n'));
  assert.ok(!fs.existsSync(file));
});
