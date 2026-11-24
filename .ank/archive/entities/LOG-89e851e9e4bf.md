---
id: LOG-89e851e9e4bf
type: log
title: "Measured: ank status --json in $TEMP/norepo-probe and in C:/Users/seanl/Documents/Projects (both no"
created: 2026-11-24T15:00:05Z
author: claude-opus:t9
scope:
  - mods/ank/**
  - tests/**
about: TASK-80f33d6f530e
seq: 1
schema: 4
version: 1
---

 git, no .ank) exits 1, stdout 0 bytes, stderr 171 bytes {"contract":1,"error":{"code":1,"name":"Generic","message":"no .ank/ found from ..."}}. resolveRepo parses only ank.stdout: JSON.parse('') throws, so it returns state incompatible, found null, drawn as 'ank speaks contract none'. tests/repo.test.js noRepo fixture had the error JSON on stdout, which real ank does not print.
