---
title: HandsOff - Protection from little fingers and paws
author: Michael Huang
pubDatetime: 2025-11-14T00:00:00Z
slug: handsoff
featured: false
draft: false
tags:
  - building
description: A macOS utility to lock keyboard/mouse while leaving the screen viewable
---

Have you ever been on a video call when your cat walks across your keyboard, sending embarrassing gibberish to your colleagues? Or had your toddler "help" with your presentation by clicking everything in sight? HandsOff is a native macOS utility that solves these problems by blocking all keyboard, trackpad, and mouse input while keeping your screen fully visible.

<!-- more -->

**Update (October 2026):** HandsOff now ships as a menu-bar app only. The CLI, PKG installer, and encrypted-config format described below are gone. For how the app was built and debugged, see [what building HandsOff taught me about steering coding agents](/posts/handsoff-steering-coding-agents).

## The Problem

Modern work often requires leaving your laptop open and running while you step away or during video calls. But this creates several risky situations:

- **Video conferencing**: Your cat walks across the keyboard, muting/unmuting you at inappropriate moments or typing nonsense in chat
- **Presentations**: Children or pets interact with your trackpad, clicking random things while you're screen sharing
- **Leaving laptop unattended**: You want to keep monitoring something on screen (a long build, a video conference, a dashboard) but don't want accidental input to disrupt it
- **Public spaces**: Protecting your laptop from curious onlookers or accidental touches while you briefly step away

Traditional solutions like locking your screen or using a screensaver hide everything, defeating the purpose. HandsOff takes a different approach: it blocks input while keeping your screen visible.

## How HandsOff Works

HandsOff uses macOS's CoreGraphics event tap system to intercept and block keyboard, trackpad, and mouse events at the system level. When locked, your screen stays on and viewable, but no input gets through except for your secret passphrase to unlock.

**Key Features:**

- **Complete Input Blocking**: All keyboard, trackpad, and mouse inputs are blocked while the screen remains visible
- **Secure Unlocking**: Unlock by typing your passphrase (even though you can't see the input)
- **Auto-Lock**: Automatically locks after 180 seconds of inactivity (configurable, 20–600 s)
- **Talk Hotkey**: Press `Ctrl+Cmd+Shift+T` when locked to pass through a spacebar press for unmuting in video calls
- **Microphone & Camera**: Video conferencing apps continue to work normally - the lock only affects input devices
- **One mode**: native menu bar app; the CLI was removed in v0.9.0

## Major Use Cases

### 1. Video Conferencing

Working from home with pets or kids around? HandsOff protects you during Zoom, Google Meet, or Teams calls:

- Lock your input while staying visible on camera
- Use the Talk hotkey (`Ctrl+Cmd+Shift+T`) to unmute without unlocking
- Your cat can walk across the keyboard without causing chaos
- Auto-lock ensures you're protected even if you forget to manually lock

### 2. Presentations and Screen Sharing

When sharing your screen:

- Lock input to prevent accidental clicks or key presses
- Keep your presentation flowing without interruption
- Unlock instantly when you need to interact again
- Perfect for demos, training sessions, or client meetings

### 3. Leaving Your Laptop Unattended

Need to step away but want to keep monitoring something?

- Lock input while keeping your screen visible
- Monitor long-running processes, builds, or deployments
- Watch video conferences continue while you grab coffee
- Protect against accidental touches in public spaces

### 4. Long-running builds and agent sessions

Lock input while a coding agent runs tests or a build. The screen stays readable, so you can watch the output land, and accidental keystrokes cannot interrupt the session.

## Getting Started

HandsOff ships as an ad-hoc signed DMG:

### Menu Bar App

1. Download the arm64 or x86_64 DMG from [GitHub Releases](https://github.com/mhuang74/handsoff-rs/releases)
2. Drag `HandsOff.app` to `/Applications`
3. Right-click → Open on first launch, then confirm the Gatekeeper prompt
4. Grant Accessibility permissions in System Settings
5. The Setup Wizard opens automatically on first run

The menu bar icon is red when locked. The menu is Lock Input, Preferences…, Change Passphrase…, Reset…, Fix Accessibility Permission…, Check for Updates…, Help, Quit. All mouse clicks are blocked while locked, so unlocking is passphrase-only.

Build from source following `DEVELOPER.md`; there is no CLI binary.

## Security

HandsOff takes security seriously:

- Passphrase stored as a SHA-256 hash of the physical keycode sequence (layout-independent, no plaintext on disk)
- Config file readable only by your user account (600 permissions)
- No network connections or telemetry
- All data stays local on your device
- Auto-unlock enabled by default: 60 min, doubling to 24 h; only a successful passphrase unlock resets it

HandsOff guards against casual interference, not a determined local actor who can reboot, kill the app, or take the machine.

## Built with Rust

HandsOff is written in Rust for performance, safety, and native macOS integration. It uses CoreGraphics event taps for reliable input blocking and integrates cleanly with macOS's Accessibility framework.

The project is open source and available on [GitHub](https://github.com/mhuang74/handsoff-rs). Contributions welcome!

---

**Requirements**: macOS 13 (Ventura) or later

**Tested on**: MacBook Air M2, macOS 15.7/15.8

**License**: See LICENSE file on GitHub
