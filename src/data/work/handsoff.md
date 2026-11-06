---
title: "HandsOff"
role: "Creator & Engineer"
team: Solo
stack:
  - Rust (CoreGraphics event taps, CFRunLoop)
  - AppKit / menu-bar UI
  - GitHub Actions (macOS CI, DMGs)
outcomes:
  - "Blocks keyboard and mouse input while keeping the screen visible"
  - "Fixed a background loop that consumed an entire CPU core"
  - "Available for Apple Silicon and Intel Macs, with guided setup"
featured: false
pubDatetime: 2026-10-06
description: "A macOS menu-bar utility that blocks keyboard and mouse input while keeping the screen readable, built to watch coding agents run without curious kids interrupting them."
---

I built [HandsOff](https://github.com/mhuang74/handsoff-rs) for one reason. Coding agents run long tasks on my machine now, and I want to read the screen while they run. Locking the screen hides the output I sat down to watch. So in practice I left the laptop open and unlocked, and my youngest did what curious kids do. (One of my Rust projects, so a little over-engineered. That's half the fun.)

HandsOff blocks the keyboard, trackpad, and mouse at the system level. The display stays fully visible. You unlock by typing a passphrase blind: no echo, no cursor. It guards against casual interference — a kid at the keyboard, a colleague, a screenshare audience. A determined attacker can reboot the machine or walk off with it. Think luggage combo lock, not bank vault.

A few things building it taught me.

**The Recovery Path Has to Be Cheaper Than the Bug**

Blocking input across the whole machine means a bug can leave the user unable to type. Reliable recovery had to be part of the design from the start. So the failure mode I designed around wasn't "someone bypasses the lock". It was "my own bug holds the keyboard hostage".

**Fail Open, Loudly**

If Accessibility access is revoked while HandsOff is running, it unlocks, posts a notification explaining the fix, and quits. Locking input without the permission to guarantee release is the one outcome worse than having no lock at all.

**Match Keycodes, Not Characters**

The passphrase is typed blind. No prompt, no caret, no feedback of any kind. HandsOff matches physical keys so the passphrase works independently of keyboard layout, and never stores it in readable form.

**Auto-Unlock Beats Lockout**

A forgotten passphrase shouldn't brick the session. Timed auto-unlock gives the user a way back in, with progressively longer waits until they unlock with the passphrase. Forgetting means waiting rather than losing access permanently.

**Every Update Breaks Your Own Permission Grant**

I have no paid Apple Developer account, so releases are ad-hoc signed. After an update, macOS can show Accessibility access as enabled even though it no longer works. Users need to reset and grant that permission again. Distribution stays scrappy: a DMG and the Gatekeeper right-click dance, no notarization, no self-updater.

**One App, One Surface**

I replaced terminal-based setup with an in-app Setup Wizard. Permission grants, passphrase capture, and preferences now live in the app that actually needs the grants.

**Delete the Dead Thread, Then Delete What Depended on It**

A background thread was spinning without doing useful work and consuming an entire CPU core. Removing it also let me simplify the app’s controls. The full detective story is in [what building HandsOff taught me about steering coding agents](/posts/handsoff-steering-coding-agents).

**Agents Write Code, Humans Run the Mac**

Coding agents wrote most of the code and tests, and they read logs well. But macOS denies them window screenshots and synthetic clicks, so I check GUI behavior, permissions, and CPU usage on the Mac myself.

HandsOff is available as a DMG for Apple Silicon and Intel Macs.

Source and releases: [mhuang74/handsoff-rs](https://github.com/mhuang74/handsoff-rs) · [releases](https://github.com/mhuang74/handsoff-rs/releases). Install walkthrough lives in the [product post](/posts/handsoff).
