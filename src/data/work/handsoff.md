---
title: "HandsOff"
role: "Creator & Engineer"
team: Solo
stack:
  - Rust (CoreGraphics event taps, CFRunLoop)
  - AppKit / menu-bar UI
  - GitHub Actions (macOS CI, DMGs)
outcomes:
  - "v0.10.0 shipped as arm64 and x86_64 DMGs; 19 tagged releases"
  - "Removed a dead CFRunLoop thread that pinned one core at ~100%"
  - "140 tests, 22 specs; tray-only setup with an in-app wizard"
featured: false
pubDatetime: 2026-10-06
description: "A macOS menu-bar utility that blocks keyboard and mouse input while keeping the screen readable, built to watch coding agents run without curious kids interrupting them."
---

I built [HandsOff](https://github.com/mhuang74/handsoff-rs) for one reason. Coding agents run long tasks on my machine now, and I want to read the screen while they run. Locking the screen hides the output I sat down to watch. So in practice I left the laptop open and unlocked, and my youngest did what curious kids do. (One of my Rust projects, so a little over-engineered. That's half the fun.)

HandsOff blocks the keyboard, trackpad, and mouse at the system level. The display stays fully visible. You unlock by typing a passphrase blind: no echo, no cursor. It guards against casual interference — a kid at the keyboard, a colleague, a screenshare audience. A determined attacker can reboot the machine or walk off with it. Think luggage combo lock, not bank vault.

A few things building it taught me.

**The Recovery Path Has to Be Cheaper Than the Bug**

Input blocking on macOS works by swallowing events at a CoreGraphics filter tap, system-wide. A callback that stalls freezes every keystroke on the machine. A callback that runs slow gets the tap silently disabled, and macOS quietly stops doing its job. So the failure mode I designed around wasn't "someone bypasses the lock". It was "my own bug holds the keyboard hostage".

**Fail Open, Loudly**

When the permission monitor sees Accessibility access get revoked at runtime, HandsOff unlocks, stops the tap, posts one notification explaining the fix, and quits (ADR 0005). Locking input without the permission to guarantee release is the one outcome worse than having no lock at all.

**Match Keycodes, Not Characters**

The passphrase is typed blind. No prompt, no caret, no feedback of any kind. That rules out depending on keyboard layout, so keys accumulate as physical keycodes and get compared against a SHA-256 hash of the sequence, with a 3-second inactivity reset. Layout-independent by construction, and nothing readable ever touches disk.

**Auto-Unlock Beats Lockout**

A forgotten passphrase shouldn't brick the session. Auto-unlock opens a window at 60 minutes and the interval doubles from there up to 24 hours. Only a real passphrase unlock resets the schedule, so forgetting degrades into a longer and longer wait instead of a permanent lockout.

**Every Update Breaks Your Own Permission Grant**

macOS TCC binds Accessibility grants to the binary path and CDHash. I have no paid Apple Developer account, so every release is an ad-hoc signed binary, and every update makes the old grant row stay lit while both real permission checks fail. The fix is a `tccutil` reset, then a fresh grant from the TCC-approved path. Distribution stays scrappy: a DMG and the Gatekeeper right-click dance, no notarization, no self-updater.

**One App, One Surface**

There used to be a CLI binary, tarballs, and a `--setup` terminal flow. All deleted (ADR 0004), replaced by an in-app Setup Wizard (ADR 0002). Permission grants, passphrase capture, and preferences now live in the app that actually needs the grants.

**Delete the Dead Thread, Then Delete What Depended on It**

A background CFRunLoop thread started "for the event tap" owned no sources, so `CFRunLoopRunInMode` returned immediately and the loop spun one core at ~100%. Removing it in v0.9.1 killed the whole rationale for a "minimal CPU mode", so the Disable/Reenable menu pair and an entire `is_disabled` state axis went too (ADR 0005). The full detective story is in [what building HandsOff taught me about steering coding agents](/posts/handsoff-steering-coding-agents).

**Agents Write Code, Humans Run the Mac**

Coding agents wrote most of the code and tests, and they read logs well. But macOS denies them window screenshots and synthetic clicks, so GUI behavior, TCC states, and CPU sampling run on-device, by me. The specs name the human steps explicitly so a stalled agent knows where its authority ends.

## Numbers

- v0.10.0 ships as `HandsOff-v0.10.0-arm64.dmg` and `HandsOff-v0.10.0-x86_64.dmg`, the 19th tagged release
- 140 unit and integration tests; 22 specs, 5 ADRs, `CONTEXT.md`, `AGENTS.md`
- macOS CI builds and tests every push; tags trigger both DMG builds via `cargo-bundle`
- 167 commits from first commit to v0.10.0, in under a year

Source and releases: [mhuang74/handsoff-rs](https://github.com/mhuang74/handsoff-rs) · [releases](https://github.com/mhuang74/handsoff-rs/releases). Install walkthrough lives in the [product post](/posts/handsoff).
