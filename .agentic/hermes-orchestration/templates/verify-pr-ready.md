# Head — Verify PR Ready Template

Completion-evidence checklist for the **head** role before reporting a PR as ready for
Karan. Per `AGENTS.md`: agent self-reports are not proof — verify with tools against
live GitHub state.

Substitute `{{owner}}/{{name}}` for the repo (e.g. `Papi-Consulting/godmode`),
`{{prNumber}}` for the PR, and run from the operated project root on the PR branch.

```bash
# Inspect PR state
gh pr view {{prNumber}} --repo {{owner}}/{{name}} \
  --json number,title,state,headRefName,baseRefName,commits,comments,reviews,latestReviews,statusCheckRollup,mergeStateStatus,url

# Verify the expected commit appears as the latest commit on the PR
LOCAL=$(git rev-parse HEAD)
REMOTE=$(gh pr view {{prNumber}} --repo {{owner}}/{{name}} --json commits --jq '.commits[-1].oid')
test "$LOCAL" = "$REMOTE" && echo "commit verified on PR" || echo "MISMATCH: local HEAD not latest PR commit"

# Inspect review surfaces (both reviewers)
gh api repos/{{owner}}/{{name}}/pulls/{{prNumber}}/reviews
gh api repos/{{owner}}/{{name}}/pulls/{{prNumber}}/comments

# Inspect CI/check status
gh pr checks {{prNumber}} --repo {{owner}}/{{name}}

# Verify merge state AFTER approval, only if a merge was actually performed
gh pr view {{prNumber}} --repo {{owner}}/{{name}} --json state,mergedAt,mergeCommit \
  --jq '{state, merged:(.mergedAt != null), mergeCommit:.mergeCommit.oid}'
```

## Ready-for-Karan gate

Mark ready only when all of the following hold from live state:

- Local HEAD is the latest commit on the PR.
- Both reviewers (reviewer-a, reviewer-b) have approved with no open blockers.
- CI/checks are green.
- The PR is linked to its governing issue.

Do not claim pushed, reviewed, ready, or merged from local state or agent summaries
alone. No auto-merge to `main` in v1 — Karan retains merge authority.
