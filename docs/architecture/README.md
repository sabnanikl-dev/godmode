# Architecture Docs

Architecture docs are the durable home for GodMode technical design decisions that are too detailed for `docs/spec.md`.

Use this folder for:

- system boundaries and module responsibilities,
- data flow and state-machine design,
- adapter and capability model decisions,
- persistence and process/PTY architecture,
- diagrams or notes that reviewers should use when checking architecture drift.

Conventions:

- Keep `docs/spec.md` as the concise current source of truth and link detailed architecture notes from there.
- Update this folder in the same PR as architecture-affecting code changes.
- Prefer small, named docs over large catch-all documents once a topic grows.
