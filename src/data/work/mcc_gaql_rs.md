---
title: "mcc-gaql-rs"
role: "Creator & Maintainer"
team: Solo
stack:
  - Rust (workspace, edition 2024)
  - tonic gRPC
  - Polars
  - rig-core / FastEmbed
  - LanceDB + Arrow
  - Cloudflare R2
outcomes:
  - "NL→GAQL generation in ~3-4s end-to-end (docs/RAG_OVERVIEW.md)"
featured: false
pubDatetime: 2026-09-28
description: Three Rust CLIs for querying, mutating, and LLM-generating Google Ads GAQL across MCC child accounts — with a RAG pipeline that knows the API schema better than a generalist model.
---

## Problem

Agencies and analysts managing Google Ads through a Manager (MCC) account live in GAQL — but the tooling is thin. The official client libraries are heavyweight, existing CLIs (the project is inspired by getyourguide/gaql-cli) don't fan out across child accounts, and asking an LLM to "write a GAQL query" produces hallucinated field names that fail at runtime and burn API quota.

Goal: a fast terminal-first stack for analysts — query many accounts at once, mutate safely, and generate correct GAQL from natural language.

## Constraints

1. **GAQL's schema is enormous and versioned.** Any generation tool needs grounded metadata for the exact API version, not the model's training data.
2. **Google Ads API has hard operational constraints** — OAuth2 flows (including SSH-remote), streaming gRPC, per-request resource accounting, and version churn every few months.
3. **Analysts shouldn't need a 400MB binary to run a query** — but the generation tool genuinely needs one.

## Decisions

- **Split the workspace by user, not by code layer.** `mcc-gaql` (query) and `mcc-gaql-mut` (mutations) stay lean (~52MB each) while `mcc-gaql-gen` carries the RAG stack (~246MB) because it embeds a vector index, an LLM client pool, and proto parsing. You install the binary sized to your job; the mutation tool was deliberately carved into its own crate in v0.19.1.
- **Ground generation in the API itself.** `mcc-gaql-gen` parses googleads-rs proto files into field metadata, LLM-enriches descriptions with retry/backoff, and indexes everything into three LanceDB vector stores (fields, resources, a curated ~80-example query cookbook). Generation runs a multi-step RAG with a 0.65 similarity threshold and a category limit of 15 to keep the model's context bounded — plus an `--explain-selection-process` flag so the analyst can audit _why_ those fields were chosen.
- **MCC fan-out as a first-class feature.** Concurrent `FuturesUnordered` queries across all linked child accounts with `--keep-going` error tolerance; results arrive as Polars DataFrames with client-side groupby/sortby — so cross-account rollup questions don't require exporting to a notebook.
- **Version pin with a guard test.** A single `GOOGLEADS_API_VERSION` constant (v25) plus a weekly workflow that detects upstream googleads-rs changes, migrates, validates, and opens a PR — version drift never sneaks in.
- **Ship where the users are.** Tag-triggered multi-platform release builds (macOS ARM64, Linux x86_64 on glibc after musl/OpenSSL issues, Linux aarch64/Graviton) via GitHub releases.

## Artifacts

- Repo: [mhuang74/mcc-gaql-rs](https://github.com/mhuang74/mcc-gaql-rs) · v0.20.0 · Keep-a-Changelog since v0.16.2
- Design docs: `docs/RAG_OVERVIEW.md` (~1,000-line design doc), `DEVELOPER.md`, ~80 spec/implementation-report docs
- CI: path-filtered builds, AI code review workflow, weekly dependency auto-upgrade

## Outcome

- NL→GAQL generation in ~3-4 seconds end-to-end with high accuracy (`docs/RAG_OVERVIEW.md`)
- ~150 unit tests across crates, including RAG retrieval-quality and negative-case integration tests
- Used in practice to test against 3 Google Ads accounts and generate monthly performance reports for the past 5 months
- **[METRIC NEEDED: RAG accuracy from the cookbook gen-test harness]**
