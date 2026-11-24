---
id: LOG-53514cad7edb
type: log
title: "No ank --json verb carries the repo root, so the resolver takes two results: ank status --json in"
created: 2026-11-24T14:36:54Z
author: claude-opus:t3
scope:
  - mods/ank/**
  - tests/**
about: TASK-9f7d810d6a7a
seq: 1
schema: 4
version: 1
---

 the cwd (repo or not, contract 1 or incompatible) and git rev-parse --path-format=absolute --show-toplevel --git-common-dir (root, and the common git dir so refs/ank is right in worktrees); git is not read for the corpus, so ADR-98bd holds. Focus change is detected in render (herdr re-renders mods on focus moves) and starts a cx.spawn from the init AsyncContext; not exercised live, only herdr-app check. A missing refs/ank (no claim yet) makes that watch reject; it is rewatched on the next repo change. ank.cmd is chosen from home() having a drive letter or backslash.
