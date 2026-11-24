---
id: TASK-c973fbe8e2a5
type: task
slug: panel-pick-a-repo-by-hand
title: "Panel: pick a repo by hand"
created: 2026-11-24T15:50:49Z
author: seanl@sean-laptop
status: open
scope:
  - mods/ank/**
  - tests/**
  - RECIPE.md
  - README.md
blocked_by: []
done_criteria: |
  When the panel has no repo to show, it lists the distinct ank repos found from the cwd of the open terminals (terminals()) plus an open-folder button (pickFolder); picking one shows it and stores it with localStorage so it is restored after a restart; while a repo is shown, the header has a control to change it the same way; a focused terminal inside another ank repo still switches the panel, per ADR-2df9e0770a79, and the picked repo is the last one kept otherwise; the candidate list and the restore logic live in lib/ and are tested by node --test; RECIPE.md and README.md describe the picker; mod-check and unit pass.
criteria_by: creator
verify: [mod-check, unit]
method: tdd
schema: 4
version: 1
---

Asked by the person after installing: with the focus on a terminal outside any ank repo (a Claude session in Documents/Projects) the panel only says to focus a terminal inside an ank repository.
