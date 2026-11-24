---
id: ADR-aad25e5c7ccc
type: adr
slug: repo-laid-out-like-the-herdr-config-home
title: Repo laid out like the Herdr config home
created: 2026-11-24T14:18:46Z
author: seanl@sean-laptop
status: proposed
scope:
  - layouts/**
  - RECIPE.md
  - preview.png
  - mods/ank/**
constraint: |
  The repo root mirrors the Herdr config home: layouts/ank.json and mods/ank/, with RECIPE.md and preview.png at the root, and the repo carries the topics herdr-layout and herdr-mod.
schema: 4
version: 3
---

This is the shape herdr.dev indexes and the shape an agent copies into ~/.config/herdr-app when installing.
