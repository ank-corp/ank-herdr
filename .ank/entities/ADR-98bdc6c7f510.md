---
id: ADR-98bdc6c7f510
type: adr
slug: corpus-read-only-through-ank-json
title: Corpus read only through ank --json
created: 2026-11-24T14:18:44Z
author: seanl@sean-laptop
status: proposed
scope:
  - mods/ank/**
constraint: |
  The ank mod reads the corpus only by running ank <verb> --json and accepting contract 1; it never parses .ank/ files or git refs itself.
schema: 4
version: 1
---

Same rule ank tui follows. The JSON contract is versioned; the file format and refs layout are ank internals. A contract other than 1 is shown as an incompatibility, not guessed at.
