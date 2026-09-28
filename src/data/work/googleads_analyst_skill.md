---
title: "googleads-analyst-skill"
role: "Designer & Author"
team: Solo
stack:
  - Claude Agent Skills
  - mcc-gaql CLI suite
  - prompt engineering
  - pandoc / weasyprint
outcomes:
  - "60+ GAQL fields validated across 12 resources before shipping (.internal validation audit)"
featured: false
pubDatetime: 2026-09-28
description: A Claude agent skill that conducts period-over-period Google Ads analysis, root-causes anomalies against change-event history, and applies approved mutations — with guardrails at every irreversible step.
---

## Problem

Asking an LLM "how is my Google Ads account doing?" gets you a plausible-looking report with no discipline: invented metrics, no distinction between _what you changed_ and _what the market did_, and no safe path from "here's the problem" to "here's the fix." Analysts need a repeatable methodology, not vibes.

Goal: turn Claude into a Google Ads performance analyst that follows a real investigative workflow — and can act on its recommendations without ever surprising the account owner.

## Constraints

1. **LLMs hallucinate GAQL field names.** `metrics.video_views` vs `metrics.video_trueview_views` looks right and fails at runtime — an error the skill's own changelog documents.
2. **Attribution is the hard analytical problem.** A conversion drop after a bid change is a different problem than the same drop with no account activity.
3. **Mutations are irreversible-ish.** Pausing a campaign is recoverable; removing one is not. A wrong write is worse than no write.
4. **Token budget.** A skill that front-loads its entire methodology into context is slow and degrades the model's attention.

## Decisions

- **Validate-then-execute gate, unconditionally.** Every GAQL query — including ones the agent just generated — must pass `mcc-gaql --validate` against API metadata before execution. Zero quota cost, hallucination contained. Before shipping, 60+ fields across 12 resources were audited against Google Ads API metadata with zero errors.
- **Progressive disclosure over mega-prompts.** The 542-line SKILL.md orchestrates seven phases; 19 reference documents (analysis patterns, correlation reference, mutation recipes, PDF templates) load on demand per phase triggers. Context stays light; rigor stays deep.
- **Deterministic change-event correlation.** Performance anomalies are scored 0–100 against the account's `change_event` history across four weighted factors — temporal proximity (30), change–symptom match (30), magnitude alignment (20), exclusivity of scope (20) — yielding confidence bands ("80–100 ⇒ >90%: attribute to user change"). The judgment call becomes a reproducible number.
- **A write path that treats the user as the approver, not the audience.** The mutation workflow is five steps: query-before → `--dry-run` → exact-command confirmation by the user → apply → query-after diff table. Irreversible removes get extra safety rules; the skill never infers intent.
- **Domain special-casing where the defaults lie.** Google Ads Grants accounts get dedicated thresholds (80–95% lost impression share is _normal_ under the $10k/month cap, $2 max CPC, >5% Search CTR eligibility rule) — a generic analyst would flag healthy Grants accounts as crises daily.
- **Encode API limits as rules, not errors.** `change_event` requires LIMIT ≤ 10,000, both dates, ≤ 30-day window — the skill states these up front instead of discovering them via failures.

## Artifacts

- Repo: [mhuang74/googleads-analyst-skill](https://github.com/mhuang74/googleads-analyst-skill) — SKILL.md, REFERENCE_INDEX.md, 19 reference docs
- Internal audits: `.internal/GAQL_FIELD_VALIDATION_REPORT.md`, enhancement changelogs with before/after worked scenarios
- Companion CLIs: [mcc-gaql-rs](/work/mcc_gaql_rs) provides query/validate/generate/mutate
- Dual-harness: the skill was backported to a second agent runtime (NanoBot) with a documented drift analysis (`specs/skills_backport.md`)
- Related writing: [Generate Google Ads Performance Report (deep-dive blog post — planned)]

## Outcome

- Two end-to-end worked sessions in `references/workflow_examples.md` (standard + Grants accounts), plus before/after comparisons in the internal enhancement changelog
- In monthly use since 2025: generates the monthly performance report for 3 Google Ads accounts
- **[METRIC NEEDED: hallucination catch rate of the validate gate in practice]**
