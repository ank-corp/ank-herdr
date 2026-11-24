---
id: TASK-9f7d810d6a7a
type: task
slug: panel-core-repo-resolution-and-event-driven-refr
title: "Panel core: repo resolution and event-driven refresh"
created: 2026-11-24T14:19:08Z
author: seanl@sean-laptop
status: done
scope:
  - mods/ank/**
  - tests/**
blocked_by: [TASK-39573bf3e443]
done_criteria: |
  mods/ank/lib/ exports a pure resolver from (focused cwd, last repo, ank result) to the repo shown, tested by node --test for: cwd inside a repo, cwd in no ank repo (keeps the last), no last repo (empty state); main.js reloads on focus change and on watchFolder events on .ank/ and .git/refs/ank and calls no timer; herdr-app check mods/ank passes.
criteria_by: creator
verify: [mod-check, unit]
proof:
  - type: test
    ref: local/04ccb4a9167a@35a6182
    tree: scope/4b75e2391a56
    criteria: 6f8042efcfbc
    verifier: mod-check@eb2d5a0db17e
    via: verifier
  - type: test
    ref: local/9e561ece1109@35a6182
    tree: scope/4b75e2391a56
    criteria: 6f8042efcfbc
    verifier: unit@60f17394a545
    via: verifier
schema: 4
version: 3
---

Follows the ADRs on repo resolution, refresh and --json reading.
