---
title: "GoogleAds Analyst Skill"
role: "Designer & Author"
team: Solo
stack:
  - Claude Agent Skills
  - mcc-gaql CLI suite
  - prompt engineering
  - pandoc / weasyprint
outcomes:
  - "Generates white-labeled Google Ads performance reports with anomalies highlighted."
featured: false
pubDatetime: 2026-09-28
description: A Claude agent skill for repeatable Google Ads performance analysis, change attribution, and user-approved account updates.
---

## Problem

Asking an LLM "how is my Google Ads account doing?" gets you a plausible-looking report with no discipline: invented metrics, no distinction between _what you changed_ and _what the market did_, and no safe path from "here's the problem" to "here's the fix." Analysts need a repeatable methodology, not vibes.

Goal: turn Claude into a Google Ads performance analyst that follows a real investigative workflow — and can act on its recommendations without ever surprising the account owner.

## Constraints

1. **LLMs hallucinate GAQL field names.** `metrics.video_views` vs `metrics.video_trueview_views` looks right and fails at runtime.
2. **Attribution is the hard analytical problem.** A conversion drop after a bid change is a different problem than the same drop with no account activity.
3. **Mutations are irreversible-ish.** Pausing a campaign is recoverable; removing one is not. A wrong write is worse than no write.
4. **Token budget.** A skill that front-loads its entire methodology into context is slow and degrades the model's attention.

## Decisions

- **Validate queries before execution.** Every GAQL query must pass `mcc-gaql --validate` against API metadata before execution. This catches invented field names before they reach the account.
- **Load guidance when needed.** The skill loads analysis guidance as each phase needs it, keeping the initial context small.
- **Compare anomalies with account changes.** Timing, symptom match, magnitude, and affected scope help distinguish the effects of account changes from external factors.
- **Require approval before writes.** The skill inspects the current state, previews the change, asks the user to approve the exact action, applies it, and verifies the result. Irreversible removals get additional safeguards.
- **Treat Grants accounts differently.** Google Ads Grants accounts have different spending and eligibility constraints. Dedicated thresholds keep the analyst from flagging normal Grants behavior as a crisis.

## Artifacts

- Repo: [mhuang74/googleads-analyst-skill](https://github.com/mhuang74/googleads-analyst-skill)
- Companion CLIs: [mcc-gaql-rs](/work/mcc_gaql_rs) provides query, validation, generation, and mutation tools

## Outcome

In monthly use since 2025: generates the monthly performance report for three Google Ads accounts.
