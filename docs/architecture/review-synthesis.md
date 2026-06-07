# Review Synthesis, Merge Gate, and the First Fix Cycle

Issue #11 turns reviewer output into structured harness state: it parses each
reviewer session's captured output into normalized findings, computes a
merge-readiness gate from those findings **and** the verified #9 commit evidence,
and drives the first verified blocker-fix cycle through the existing run state
machine. It builds on the run state machine (#7), the builder handoff (#8), the
commit-verification evidence layer (#9), and reviewer launch/capture (#10).

GodMode is an agent harness, not a self-report trust layer. Parsed reviewer
findings are **advisory**: they surface blockers and drive the fix loop, but the
merge gate still requires the verified #9 evidence — a reviewer's own marker or
PASS line is never enough to reach `merge_ready`.

## Boundaries

| Concern | Owner |
| --- | --- |
| Finding/result/merge-gate/findings types | `src/shared/types.ts` (`ReviewerFinding`, `ReviewerResult`, `MergeReadiness`, `RunFindings`, `ReviewSynthesisResult`) |
| Pure parsing + merge gate + blocker text | `src/main/findings.ts` (`parseReviewerOutput`, `computeMergeReadiness`, `acceptedBlockers`, `renderBlockersText`) |
| Pointer-first fix handoff | `composeFixHandoff` in `src/main/handoff.ts` |
| Findings persistence + reviewer-artifact read | `src/main/artifacts.ts` (`writeRunFindings`, `readReviewerArtifact`) |
| Findings on the run snapshot | `setRunFindings` / `setCurrentRunFindings` in `src/main/run.ts` |
| Synthesis + fix orchestration (impure: `gh`/PTY/fs) | `handleSynthesizeReviews` / `handleSendFix` in `src/main/index.ts` |
| Dashboard surfacing | `src/renderer/components/ReviewSynthesisPane.tsx` |

The pure core (`findings.ts`, `composeFixHandoff`) is Electron/`gh`/filesystem-free
and unit-tested directly (`test/findings.test.js`). The IO half reads captured
artifacts, re-runs #9, persists findings, and dispatches transitions.

## Parsing reviewer output

`parseReviewerOutput` consumes one reviewer session's captured log (the local
`.godmode/runs/<run-id>/<reviewer-id>.log` artifact from #10) and produces a
`ReviewerResult` with status `pass` / `fail` / `ambiguous`. It recognizes the
shapes the reviewer role docs and the product spec define:

- the completion marker `DONE: ROLE=reviewer STATUS=pass|fail BLOCKING=<count>`,
- a reviewer `PASS` line (e.g. `Reviewer A: PASS — …`),
- `BLOCKING A-1` / `BLOCKING B-1` blocks with `File:` (with optional `:line`),
  `Issue:`, `Why it blocks:`, and `Suggested fix:`.

Markers help parsing but are not proof, so the parser cross-checks them against
the parsed blocks. Anything missing, malformed, contradictory, or internally
inconsistent is `ambiguous` — never a silent pass:

- empty/unparseable output;
- a `pass` marker with a non-zero count or a parsed `BLOCKING` block;
- a `fail` marker with zero parseable blocks;
- a `PASS` line and a `BLOCKING` block together;
- conflicting `DONE` markers.

Cleanly-parsed blocking findings on a `fail` are marked `accepted` (this first
slice accepts clear blockers by default); on an `ambiguous` result they are
marked `needs_human`, so ambiguous output never feeds accepted blockers into a
fix cycle.

## The merge gate

`computeMergeReadiness` is `merge_ready` only when **all** hold:

1. Reviewer A passed (or has zero accepted blocking findings) and is not ambiguous,
2. Reviewer B likewise,
3. the latest #9 commit verification is `verified`,
4. no accepted blockers remain.

It returns an ordered `reasons[]` explaining any unmet condition and a
`recommendation`:

- `needs_human` — any ambiguous/contradictory reviewer output;
- `request_fix` — accepted blockers remain;
- `merge_ready` — every gate satisfied;
- `hold` — no blockers and no ambiguity, but a non-reviewer gate is unmet (e.g.
  the PR is not verified). The operator refreshes/acts; nothing auto-fires.

## Driving the state machine

`handleSynthesizeReviews` runs from `reviewers_running` / `reviewers_rerunning`:

1. re-run the #9 gate live and record it (with the same stale-context guard the
   reviewer launch/comment paths use);
2. parse each tracked reviewer's captured output;
3. compute the merge gate;
4. persist `RunFindings` on the run and to `.godmode/runs/<run-id>/findings.json`;
5. advance `synthesize_reviews → review_synthesis`, then route by recommendation:
   - `merge_ready` → `mark_merge_ready`,
   - `request_fix` → `request_fix` (→ `builder_fixing`) when the cycle budget has
     room, else `exceed_max_cycles` (→ `max_cycles_exceeded`),
   - `needs_human` → `flag_needs_human`,
   - `hold` → stay in `review_synthesis`.

Max-cycle handling stays authoritative in the state machine: `request_fix`
increments `cycle` and the guard refuses it once `cycle >= maxCycles`, so the
loop deterministically stops at the budget.

## The fix cycle

On `request_fix`, `composeFixHandoff` renders the `builder_fix` template with the
verified PR coordinates and the normalized accepted-blocker text, so `{{blockers}}`
is never left unresolved. Like every GodMode handoff it is **pointer-first**: the
blockers travel as a compact capsule, but the builder is pointed back to the live
PR diff/threads/reviews and the operated project's canonical docs — not a pasted
reviewer transcript. The rendered handoff is returned for operator review and sent
into the builder session via `handleSendFix` (which re-verifies to bind fresh PR
coordinates). Sending records that the fix prompt was *delivered*, never that the
fix succeeded.

After the builder pushes, the operator dispatches `push_fix` (recording the new
expected commit), then reruns reviewers. The rerun path (`handleStartReviewers`
from `fix_pushed`) re-runs the #9 gate and refuses to launch unless the pushed
commit is `verified` on the PR branch — so reviewers only re-review a verified
fix. This is the "verify the pushed commit before rerunning reviewers" guarantee.

## Out of scope (v1)

Multi-cycle polish beyond the first re-review loop, a rich blocker dismissal
UI/audit trail, inline review comments, and auto-merge. Karan/manual GitHub merge
remains the only merge path — `merge_ready` is a gate, not a merge.
