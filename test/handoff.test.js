// Builder handoff composition tests for issue #8. Pure function only — no
// filesystem or Electron — so they run under Node's built-in test runner against
// the compiled main output (`npm run build:main` first). Run via `npm test`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeBuilderHandoff, promptDigest } from '../dist/main/handoff.js';
import { DEFAULT_CONFIG } from '../dist/main/config.js';
import { createRun } from '../dist/main/run.js';

const NOW = '2026-06-06T12:00:00.000Z';

function githubRun(overrides = {}) {
  return {
    ...createRun({
      sourceType: 'github_issue',
      sourceId: '8',
      issueNumber: 8,
      issueTitle: 'Bind selected issue to builder handoff',
      now: NOW,
      id: 'run-8',
    }),
    status: 'issue_selected',
    ...overrides,
  };
}

test('a bound GitHub issue produces a sendable handoff with no unresolved tokens', () => {
  const run = githubRun({
    sourceDetail: {
      url: 'https://github.com/x/y/issues/8',
      body: 'Implement the handoff binding.',
      labels: ['enhancement'],
      comments: [{ author: 'karan', body: 'Keep the gate manual.' }],
    },
  });
  const handoff = composeBuilderHandoff(DEFAULT_CONFIG, run, {
    projectName: 'godmode',
    docPointers: ['docs/architecture/run-state-machine.md'],
  });

  assert.equal(handoff.isMock, false);
  assert.equal(handoff.canSend, true);
  assert.deepEqual(handoff.missingVariables, []);
  // Acceptance: no unresolved issue tokens remain.
  assert.ok(!handoff.prompt.includes('{{issueNumber}}'));
  assert.ok(!handoff.prompt.includes('{{issueTitle}}'));
  assert.match(handoff.prompt, /issue #8/);
  // Grounded in the harness reading rules and the real issue body/comments.
  assert.match(handoff.prompt, /AGENTS\.md/);
  assert.match(handoff.prompt, /docs\/spec\.md/);
  assert.match(handoff.prompt, /FRESH builder session/);
  assert.match(handoff.prompt, /Implement the handoff binding\./);
  assert.match(handoff.prompt, /@karan: Keep the gate manual\./);
  assert.match(handoff.prompt, /docs\/architecture\/run-state-machine\.md/);
  assert.equal(handoff.sourceLabel, 'issue #8 — Bind selected issue to builder handoff');
});

test('a manual task is blocked from direct send (no issue number to bind)', () => {
  const run = {
    ...createRun({
      sourceType: 'manual_task',
      sourceId: 'task-x',
      issueTitle: 'Tidy the cockpit',
      sourceDetail: { body: 'Make the panes more compact.' },
      now: NOW,
      id: 'run-task',
    }),
    status: 'issue_selected',
  };
  const handoff = composeBuilderHandoff(DEFAULT_CONFIG, run, { projectName: 'godmode' });

  assert.equal(handoff.isMock, false);
  assert.equal(handoff.canSend, false);
  assert.ok(handoff.missingVariables.includes('issueNumber'));
  assert.match(handoff.blockedReason, /needs_spec/);
  // The manual task text is still grounded so it can be specced.
  assert.match(handoff.prompt, /manual task task-x/);
  assert.match(handoff.prompt, /Make the panes more compact\./);
});

test('no bound run yields a clearly-labeled mock handoff that cannot be sent', () => {
  const handoff = composeBuilderHandoff(DEFAULT_CONFIG, null, { projectName: 'godmode' });
  assert.equal(handoff.isMock, true);
  assert.equal(handoff.canSend, false);
  assert.match(handoff.prompt, /mock\/demo preview/);
  assert.match(handoff.prompt, /\{\{issueNumber\}\}/);
  assert.equal(handoff.sourceLabel, undefined);
});

test('config command overrides flow into the handoff template', () => {
  const custom = { ...DEFAULT_CONFIG, commands: { builder_start: 'BUILD #{{issueNumber}}: {{issueTitle}}' } };
  const handoff = composeBuilderHandoff(custom, githubRun(), { projectName: 'godmode' });
  assert.match(handoff.prompt, /BUILD #8: Bind selected issue to builder handoff/);
  assert.equal(handoff.canSend, true);
});

test('promptDigest collapses whitespace and bounds length', () => {
  assert.equal(promptDigest('a\n  b   c'), 'a b c');
  const long = 'x'.repeat(200);
  const digest = promptDigest(long, 50);
  assert.equal(digest.length, 51); // 50 chars + ellipsis
  assert.ok(digest.endsWith('…'));
});
