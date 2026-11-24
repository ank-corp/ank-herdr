---
id: LOG-45f540ac00ea
type: log
title: "Fix: resolveRepo parses ank.stderr when ank.stdout is empty (herdr ExecResult carries stderr)."
created: 2026-11-24T15:00:56Z
author: claude-opus:t9
scope:
  - mods/ank/**
  - tests/**
about: TASK-80f33d6f530e
seq: 2
schema: 4
version: 1
---

 Regression: tests/repo.test.js noRepo now the real capture tests/fixtures/norepo/status.stderr.json (stdout ''); before the fix 2 tests red: kept case got state incompatible found null, empty case got incompatible found null; after: 76 pass 0 fail.
