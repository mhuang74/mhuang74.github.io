---
title: "HandsOff"
role: "Creator & Engineer"
team: Solo
stack:
  - Rust (CoreGraphics event taps, CFRunLoop)
  - AppKit / menu-bar UI
  - SHA-256 keycode passphrases
  - GitHub Actions (macOS CI, DMGs)
outcomes:
  - "v0.10.0 shipped as arm64 and x86_64 DMGs; 19 tagged releases"
  - "Removed a dead CFRunLoop thread that pinned one core at ~100%"
  - "140 tests, 22 specs, 5 ADRs; tray-only setup with an in-app wizard"
featured: false
pubDatetime: 2026-10-06
description: "A macOS menu-bar utility that blocks keyboard and mouse input while keeping the screen readable, built to watch coding agents run without a toddler interrupting them."
---

## Problem

I watched long-running work on my own machine: builds, test suites, coding agents churning through both. Locking the screen or letting the screensaver fire hides the very output I sat down to read, so in practice I left the laptop open and unlocked, and a toddler did what toddlers do.

HandsOff blocks the keyboard, trackpad, and mouse at the system level while leaving the display fully visible. You unlock by typing a passphrase blind, with no echo and no cursor. The threat model in the README sets the scope honestly: it guards against casual interference, a child, a colleague, or a screenshare audience, and not against a determined local actor who can reboot the machine, kill the app, or walk off with the laptop.

## Constraints

1. **A filter event tap is system-wide and fail-closed.** Input blocking works by swallowing events at head-insert for the whole session, so a callback that stalls freezes every keystroke and click on the machine, and a callback that runs slow gets the tap silently disabled by macOS, which restores input and quietly stops protection. Blocking input is a category where the recovery path has to be cheaper than the bug.
2. **TCC Accessibility grants bind to the binary path and CDHash.** Every update replaces the ad-hoc signed binary, so the old grant row stays lit while both real permission checks fail. The re-grant flow only works when the app runs from the TCC-approved path, and stale grants have to be reset with `tccutil` before a fresh one can bind.
3. **The passphrase is typed blind.** It cannot prompt for text, show a caret, or depend on keyboard layout, since the user has no display feedback at all while locked.
4. **No paid Apple Developer account.** Distribution is an ad-hoc signed DMG plus the Gatekeeper right-click dance; no notarization, no self-updater, no scheduled background daemon.

## Decisions

- **Match the passphrase on physical keycodes, store only a hash.** Keys accumulate into a buffer with a 3 s inactivity reset and are compared against a SHA-256 hash of the keycode sequence. Layout-independent by construction, no plaintext or reversible ciphertext on disk.
- **Fail open on permission loss.** When the permission monitor sees a runtime revocation, the app unlocks, stops the tap, shows one notification explaining how to fix it, and quits (ADR 0005). Holding input hostage behind a permission the app no longer has is the one outcome worse than having no lock at all.
- **Auto-unlock as a backoff schedule, not a single timeout.** Enabled by default, the first window opens at 60 minutes and the interval doubles to a 24 h ceiling. Only a real passphrase unlock resets it, so a forgotten passphrase degrades into an increasingly long wait instead of a permanent lockout.
- **One surface: tray app with an in-app Setup Wizard.** The CLI binary, its tarballs, and the `--setup` terminal flow were removed (ADR 0004); the wizard replaced them (ADR 0002) so permission grants, passphrase capture, and preferences live in the app that needs the grants.
- **Delete the dead thread, then delete what depended on it.** A background CFRunLoop thread started "for the event tap" owned no sources, so `CFRunLoopRunInMode` returned immediately and the loop spun a core at ~100%. Removing it (v0.9.1) killed the "minimal CPU mode" rationale, so the Disable/Reenable menu pair and an entire `is_disabled` state axis went too (ADR 0005).
- **Split verification between agent and human.** Agents write code and tests and read logs; GUI, TCC, and CPU checks run on the machine, because macOS denies agents window screenshots and synthetic clicks. The specs name the on-device steps explicitly so a stalled agent knows where its authority ends.

## Artifacts

- Repo: [mhuang74/handsoff-rs](https://github.com/mhuang74/handsoff-rs) · [releases](https://github.com/mhuang74/handsoff-rs/releases) · v0.10.0
- Design record: 22 specs (including a deep design review, a CPU-spin investigation, and a hang-risk assessment with a documented revision note), 5 ADRs, `CONTEXT.md`, `AGENTS.md`
- CI: macOS build and test on every push, tag-triggered arm64 and x86_64 DMG builds via `cargo-bundle`, AI code review workflow
- Tests: 140 unit and integration tests across config, auth, app state, wizard flows, and single-instance locking

## Outcome

- v0.10.0 shipping as `HandsOff-v0.10.0-arm64.dmg` and `HandsOff-v0.10.0-x86_64.dmg`, the 19th tagged release
- Input blocked at the system level while the display stays visible; unlock is passphrase-only, layout-independent, and silent
- The one-core busy spin is gone, along with the menu state that existed only to work around it
- Permission revocation now releases input with one notification instead of wedging the session
- 167 commits from first commit to v0.10.0, in under a year
