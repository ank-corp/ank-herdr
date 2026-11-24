---
id: LOG-9efd37fe61c8
type: log
title: "Fixtures captured with ank 0.9.5 from throwaway repos in the session scratchpad (empty: fresh init;"
created: 2026-11-24T14:30:50Z
author: claude-opus:t2
scope:
  - mods/ank/lib/**
  - tests/**
about: TASK-39573bf3e443
seq: 1
schema: 4
version: 1
---

 full: done, claimed-by-fixture:b, blocked_by-it, open tasks and a proposed ADR; ANK_WATCH_DECLARE=off, default_branch set). Accepting an ADR is a human act, so the constraints shape comes from this repo's own read-only 'ank context mods/ank/lib --json' (tests/fixtures/constraints/). Adapters in mods/ank/lib/adapters.js throw IncompatibleContract {expected, found} for another contract (found=n) or no contract/bad JSON (found=null). Readings taken: find --status open excludes in_progress, so the claimed task shows via status.elsewhere and context; context phase = claimed when state is claimed:<holder>, else ready/blocked from ank's ready flag; graph is a forest rooted at unblocked tasks, cycles cut per path. tests/index.js already imports every *.test.js, so no registration was needed.
