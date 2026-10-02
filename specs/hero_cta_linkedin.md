# Hero CTA — LinkedIn, Superseding T4's Hero-CTA-to-`/work`

_Supersedes: the hero-CTA clause of T4 in `specs/pm_portfolio_repositioning.md` ("headline = explicit PM + builder claim, one-sentence subcopy, CTA to `/work`") — hero CTA portion only. Recorded per the supersede-not-edit workflow._

## Decision (grilling session, 2026-10-02)

- Hero primary CTA and cta-strip button both link to LinkedIn, label **"Connect on LinkedIn"**, opening in a new tab. URL is sourced from the `SOCIALS` entry in `src/constants.ts` (single source of truth).
- The published email address stays visible in the cta-strip lead copy and in the `SOCIALS` Mail icon (footer icon keeps `mailto:`, convention not CTA). Email is no longer a button CTA anywhere.
- A delegated click listener fires `gtag("event", "cta_click", { target, location })` for both buttons — the site previously had zero CTA measurement (GA4 `config` only).

## Why

- **Desktop mailto is a dead end.** On mobile `mailto:` is convenient (app picker), but on desktop it launches an email client many visitors — and the owner — don't use. Channel favors uniformity across devices.
- **Audience lives on LinkedIn.** TPM hiring flows happen there; `CONTEXT.md` already names linkedin.com/in/mhuang74 the career-history source of truth.
- **Connections-only constraint.** Owner has no Premium/Open Profile, so strangers cannot DM; "Connect on LinkedIn" is the honest copy under both settings.
- **No new dependencies.** Static GitHub Pages: a form would require Web3Forms/Formspree, booking would require Calendly — declined.
- **GA bootstrap fix (pre-existing bug found during verification).** `GoogleAnalytics.astro`'s `gtag(...args)` spread into `dataLayer.push(...args)` — positional pushes that gtag.js reads as separate model-path messages, so `config` never dispatched and GA4 never registered the destination (no `g/collect` hits, only enhanced-measurement `gtm.linkClick` auto-events). Fixed to the snippet-standard `function gtag() { dataLayer.push(arguments); }`. Verified post-fix: `en=cta_click` collect hits carry `ep.target=linkedin`, `ep.location=hero|cta-strip`.
- **T4 was already implicitly superseded.** The shipped page (PRs #4/#5) deviates from T4's locked section order and used a `mailto:` hero CTA with a `#work` anchor. This note makes the deviation explicit; T4's other clauses remain the record.

## Non-goals

- About page contact CTA unchanged.
- `data-od-id` names on the touched CTA lines renamed (`hero-cta-linkedin`, `cta-linkedin`); other `data-od-id` attributes remain inert (no code reads them).
