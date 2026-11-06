---
title: "MCC GAQL Tool"
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
  - "Queries campaign metrics across linked Google Ads accounts and generates GAQL from plain English."
featured: false
pubDatetime: 2026-09-28
description: Rust command-line tools for querying multiple Google Ads accounts, making approved changes, and generating GAQL from natural language.
---

## Problem

Agencies and analysts managing Google Ads through a Manager (MCC) account live in GAQL — but the tooling is thin. The official client libraries are heavyweight, existing CLIs (the project is inspired by getyourguide/gaql-cli) don't fan out across child accounts, and asking an LLM to "write a GAQL query" produces hallucinated field names that fail at runtime and burn API quota.

Goal: a fast terminal-first stack for analysts — query many accounts at once, mutate safely, and generate correct GAQL from natural language.

## Constraints

1. **GAQL's schema is enormous and versioned.** Any generation tool needs grounded metadata for the exact API version, not the model's training data.
2. **Account access and API changes need ongoing care.** Authentication must work locally and over SSH, requests have usage limits, and API versions change regularly.
3. **Basic queries should stay lightweight.** Analysts shouldn't need to install the generation stack just to run a query.

## Decisions

- **Separate tools by task.** `mcc-gaql` handles queries, `mcc-gaql-mut` handles mutations, and `mcc-gaql-gen` generates queries from natural language. Query and mutation tools stay lightweight; generation ships separately with the retrieval stack it needs.
- **Ground generation in API metadata.** The generator retrieves field and resource information from the API schema, along with relevant example queries. Analysts can inspect why fields were selected rather than trusting an unexplained answer.
- **Query linked accounts together.** Concurrent queries across child accounts can continue when one account fails. Results can be grouped and sorted across accounts without exporting them to a notebook.
- **Keep pace with API changes.** Automated upstream checks detect API changes, validate migrations, and open pull requests for review.
- **Distribute ready-to-run binaries.** macOS and Linux builds are available through GitHub releases.

## Artifacts

- Repo: [mhuang74/mcc-gaql-rs](https://github.com/mhuang74/mcc-gaql-rs)

## Outcome

- Natural-language queries generate GAQL in approximately 3–4 seconds.
- Used with three Google Ads accounts to generate monthly performance reports.
