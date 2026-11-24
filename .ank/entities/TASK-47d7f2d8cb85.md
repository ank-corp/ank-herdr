---
id: TASK-47d7f2d8cb85
type: task
slug: action-accept-a-proposed-adr-or-spec-from-the-qu
title: "Action: accept a proposed ADR or spec from the queue"
created: 2026-11-24T14:19:09Z
author: seanl@sean-laptop
status: done
scope:
  - mods/ank/**
  - tests/**
blocked_by: [TASK-6118dd50dd44]
done_criteria: |
  Each entry of the ratification queue has an accept button, enabled only when the repo's branch equals its default_branch, that runs ank accept <id> in the repo and reports the outcome with notify, including ank's error message on refusal; the gating and the argv are built in lib/ and tested by node --test; herdr-app check mods/ank passes.
criteria_by: creator
verify: [mod-check, unit]
proof:
  - type: test
    ref: local/04ccb4a9167a@4972591
    tree: scope/5c25aa78eb81
    criteria: 7531ae893163
    verifier: mod-check@eb2d5a0db17e
    via: verifier
  - type: test
    ref: local/43298a9029e5@4972591
    tree: scope/5c25aa78eb81
    criteria: 7531ae893163
    verifier: unit@60f17394a545
    via: verifier
schema: 4
version: 3
---

ank accept is the only writing command the mod may run.
