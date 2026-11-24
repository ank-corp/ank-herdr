---
id: ADR-58720bdf3ad1
type: adr
slug: pure-logic-in-lib-tested-with-node
title: Pure logic in lib, tested with node
created: 2026-11-24T14:18:46Z
author: seanl@sean-laptop
status: proposed
scope:
  - mods/ank/**
  - tests/**
constraint: |
  Everything that does not draw or call herdr (parsing ank JSON, sorting, the blocked_by tree, repo resolution, command and prompt building) lives in mods/ank/lib/ with no import of herdr, gpui-kit or gpui-base, and is covered by node --test in tests/.
schema: 4
version: 1
---

gpui-kit UI cannot run under node; separating the logic makes it testable by the unit verifier.
