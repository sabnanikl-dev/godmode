import fs from 'node:fs';
import path from 'node:path';
import type { BuilderHandoff, RunSnapshot } from '../shared/types.js';
import { DEFAULT_TEMPLATES, buildRoleResolutions, renderTemplate } from './agents.js';
import { DEFAULT_CONFIG, loadConfig, type GodmodeConfig } from './config.js';
import { getSelectedProjectRoot } from './project.js';

/**
 * Builder handoff composition (issue #8). This binds a selected GitHub issue or
 * manual task into the exact prompt GodMode would write into the configured
 * builder session, grounded in the harness reading rules. Producing a handoff
 * never sends anything — it is the auditable artifact the operator reviews
 * before the explicit approve-send gate (wired in `src/main/index.ts`).
 *
 * The core ({@link composeBuilderHandoff}) is pure and Electron/PTY-free so it
 * can be unit-tested directly. {@link getCurrentHandoff} is the thin wrapper that
 * reads the loaded config, the current run, and the project's doc pointers.
 */

/** Bound to a builder session, so keep large issue bodies from flooding the PTY. */
const MAX_BODY_CHARS = 6000;
const MAX_COMMENT_CHARS = 1200;
const MAX_COMMENTS = 10;

/** Top-level pointer dirs the builder should consult when relevant to the task. */
const POINTER_DIRS = ['docs/architecture', 'docs/conventions'];

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}\n…[truncated ${trimmed.length - max} chars]`;
}

function deliveryFor(mode: string): BuilderHandoff['delivery'] {
  return mode === 'oneshot' ? 'oneshot' : 'interactive';
}

/** Single-line preview of a prompt, for the audit log. */
export function promptDigest(prompt: string, max = 140): string {
  const oneLine = prompt.replace(/\s+/g, ' ').trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max)}…`;
}

/**
 * The required-reading + task-detail block appended to every handoff. Leads with
 * the fresh-session and harness reading expectations from AGENTS.md so the
 * builder always orients before implementing, then grounds the work in the bound
 * source (issue body/comments or manual task text).
 */
function groundingBlock(run: RunSnapshot | null, docPointers: string[]): string {
  const lines: string[] = [];
  lines.push('== Builder handoff (GodMode) ==');
  lines.push('Start a FRESH builder session in the operated project root. Read before implementing:');
  lines.push('- AGENTS.md — process, authority, and safety rules');
  lines.push('- docs/spec.md — current product/technical spec');
  lines.push('- the task source and detail below (issue body/comments or task text)');
  const pointers = docPointers.length > 0 ? ` (e.g. ${docPointers.join(', ')})` : '';
  lines.push(`- relevant docs under ${POINTER_DIRS.join('/ and ')}/${pointers}`);
  lines.push('');

  if (!run) {
    lines.push('Task source: none — mock/demo preview (no issue or task bound).');
    lines.push('');
    lines.push('Task detail:');
    lines.push('(no detail bound — select an issue or create a manual task for a real handoff)');
    lines.push('');
    lines.push('When done: test, commit, push, and open a PR that links the task.');
    return lines.join('\n');
  }

  const detail = run.sourceDetail ?? {};
  if (run.sourceType === 'github_issue') {
    const title = run.issueTitle ?? '(untitled)';
    lines.push(`Task source: issue #${run.issueNumber} — ${title}`);
    if (detail.url) lines.push(`URL: ${detail.url}`);
    if (detail.labels && detail.labels.length > 0) lines.push(`Labels: ${detail.labels.join(', ')}`);
    lines.push('');
    lines.push('Issue body:');
    lines.push(detail.body ? truncate(detail.body, MAX_BODY_CHARS) : '(issue body unavailable)');
    const comments = (detail.comments ?? []).slice(0, MAX_COMMENTS);
    if (comments.length > 0) {
      lines.push('');
      lines.push(`Comments (${comments.length}):`);
      for (const comment of comments) {
        lines.push(`- @${comment.author}: ${truncate(comment.body, MAX_COMMENT_CHARS)}`);
      }
    }
  } else {
    const title = run.issueTitle ? ` — ${run.issueTitle}` : '';
    lines.push(`Task source: manual task ${run.sourceId}${title}`);
    lines.push('');
    lines.push('Task detail:');
    lines.push(detail.body ? truncate(detail.body, MAX_BODY_CHARS) : '(no task text provided)');
  }

  lines.push('');
  lines.push('When done: test, commit, push, and open a PR that links the task.');
  return lines.join('\n');
}

/**
 * Compose the builder handoff for a run (or a mock when none is bound). Pure:
 * given a config, the run snapshot, and optional project metadata, it renders the
 * configured `builder_start` template bound to the run, appends the grounded
 * required-reading/task block, and reports whether the result is safe to send.
 *
 * A handoff is sendable only when a real source is bound (`!isMock`) and the
 * template left no unresolved variables. A `manual_task` run has no issue number,
 * so `{{issueNumber}}` stays unresolved and send is blocked — the operator routes
 * a vague task to `needs_spec` rather than sending it blindly.
 */
export function composeBuilderHandoff(
  config: GodmodeConfig,
  run: RunSnapshot | null,
  options: { projectName?: string; docPointers?: string[] } = {},
): BuilderHandoff {
  const projectName = options.projectName;
  const docPointers = options.docPointers ?? [];

  const builder = buildRoleResolutions(config).find((role) => role.role === 'builder');
  const agentId = builder?.agentId ?? config.roles.builder.agent;
  const agent = config.agents[agentId];
  const displayName = builder?.displayName ?? agentId;
  const adapter = builder?.adapter ?? agent.adapter;
  const mode = builder?.mode ?? agent.mode;
  const project = projectName ?? '<selected-project>';
  const commandLine = `${agent.command} --project ${project}`;

  const templates = { ...DEFAULT_TEMPLATES, ...config.commands };
  const vars: Record<string, string> = {};
  if (projectName) vars.projectName = projectName;
  if (run?.issueNumber !== undefined) vars.issueNumber = String(run.issueNumber);
  if (run?.issueTitle) vars.issueTitle = run.issueTitle;
  const { prompt: templatePrompt, missingVariables } = renderTemplate(templates.builder_start, vars);

  const prompt = `${templatePrompt}\n\n${groundingBlock(run, docPointers)}`;

  const isMock = run === null;
  const canSend = !isMock && missingVariables.length === 0;

  let blockedReason: string | undefined;
  if (isMock) {
    blockedReason = 'No issue or task is bound. Select a GitHub issue or create a manual task to build a real handoff.';
  } else if (run!.sourceType === 'manual_task') {
    blockedReason =
      'Manual tasks have no GitHub issue number to bind ({{issueNumber}} unresolved). Route to needs_spec or attach a GitHub issue before sending.';
  } else if (missingVariables.length > 0) {
    blockedReason = `Unresolved template variables: ${missingVariables.join(', ')}.`;
  }

  const sourceLabel = !run
    ? undefined
    : run.sourceType === 'github_issue'
      ? `issue #${run.issueNumber} — ${run.issueTitle ?? '(untitled)'}`
      : `manual task ${run.sourceId}${run.issueTitle ? ` — ${run.issueTitle}` : ''}`;

  return {
    isMock,
    sourceType: run?.sourceType,
    sourceId: run?.sourceId,
    sourceLabel,
    issueUrl: run?.sourceDetail?.url,
    displayName,
    agentId,
    adapter,
    delivery: deliveryFor(mode),
    commandLine,
    prompt,
    missingVariables,
    canSend,
    blockedReason,
  };
}

/**
 * Read the project's top-level architecture/convention doc filenames so the
 * handoff can name concrete pointers. Best-effort and bounded; returns [] when
 * the dirs are absent or unreadable.
 */
export function collectDocPointers(projectRoot: string): string[] {
  const pointers: string[] = [];
  for (const dir of POINTER_DIRS) {
    try {
      const entries = fs.readdirSync(path.join(projectRoot, dir), { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') {
          pointers.push(`${dir}/${entry.name}`);
        }
      }
    } catch {
      // Dir absent/unreadable — pointers stay best-effort.
    }
  }
  return pointers.sort().slice(0, 8);
}

/**
 * Build the handoff for the current run, reading the loaded config and project
 * doc pointers. Never throws: a missing/invalid config falls back to safe
 * defaults, exactly like the registry.
 */
export function getCurrentHandoff(run: RunSnapshot | null): BuilderHandoff {
  const loaded = loadConfig();
  const config = loaded.status === 'loaded' ? loaded.config : DEFAULT_CONFIG;
  const docPointers = collectDocPointers(getSelectedProjectRoot());
  return composeBuilderHandoff(config, run, { projectName: loaded.projectName, docPointers });
}
