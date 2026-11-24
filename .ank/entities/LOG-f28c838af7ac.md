---
id: LOG-f28c838af7ac
type: log
title: "lib/accept.js: acceptGate(statusView) enabled only when branch is non-null and equals"
created: 2026-11-24T14:55:09Z
author: claude-opus:t6
scope:
  - mods/ank/**
  - tests/**
about: TASK-47d7f2d8cb85
seq: 1
schema: 4
version: 1
---

 default_branch, else a reason drawn under the row (another branch / no branch / ank knows no default branch: ank 0.9.5 reports default_branch null in a repo with no origin, so the button stays disabled there); acceptCommand -> {program: ankProgram(home()), args: ['accept', id], cwd: repo root}, refusing ids that are not ADR-/SPEC-<hex> (no flag can ride in) and a program that is not ank; acceptOutcome -> notify payload, success with ank's stdout line, refusal with ank's stderr whole (error[N] + the -> resolving command), stdout or exit code as fallback. main.js: accept button per queue row, 'accepting…' while running, notify() the outcome, then reload. Live: lib argv exec'd with ank.cmd in a scratchpad repo with a bare origin: first accept 'accepted ADR-45f9… -> 65e767c', second 'error[6]: … already ratified'. Never run against this repo. Not clicked in herdr-app: herdr-app check only.
