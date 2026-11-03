---
title: HandsOff - Protection from little fingers and paws
author: Michael Huang
pubDatetime: 2025-11-14T00:00:00Z
slug: handsoff
featured: false
draft: false
tags:
  - building
description: A macOS utility to lock keyboard and mouse while leaving the screen viewable
---

Have you ever been on a video call when your cat walks across your keyboard and types gibberish into chat? Or had your curious kid "help" with your presentation by clicking everything in sight? HandsOff is a small macOS utility for exactly that. It blocks all keyboard, trackpad, and mouse input while your screen stays fully visible.

<!-- more -->

HandsOff today is a menu-bar app, and for how it was built and debugged, see [what building HandsOff taught me about steering coding agents](/posts/handsoff-steering-coding-agents).

## The problem

Modern work often means leaving your laptop open and running while you step away or sit on a video call. That invites a few bad situations:

- Video conferencing. Your cat walks across the keyboard, mutes you at the wrong moment, or types nonsense in chat.
- Presentations. Children or pets interact with your trackpad and click random things while you screen share.
- Leaving the laptop unattended. You want to keep monitoring something on screen but you do not want stray input to disrupt it.
- Public spaces. You block casual interference while you briefly step away.

Traditional fixes like locking your screen hide everything and defeat the point. HandsOff takes a different approach. It blocks input while keeping your screen visible.

## How HandsOff works

HandsOff uses macOS CoreGraphics event taps to intercept keyboard, trackpad, and mouse events at the system level. When locked, your screen stays on and viewable, but no input gets through except for your secret passphrase to unlock.

Key features:

- Complete input blocking. All keyboard, trackpad, and mouse input is blocked while the screen remains visible.
- Secure unlocking. You unlock by typing your passphrase blind. No echo, no cursor.
- Auto-lock. Locks automatically after 180 seconds of inactivity. Configurable from 20 to 600 seconds.
- Talk hotkey. Press `Ctrl+Cmd+Shift+T` when locked to pass through a spacebar press for unmuting in video calls.
- Microphone and camera keep working. The lock only affects input devices.
- One mode. It is a native menu-bar app and nothing else.

## Major use cases

### Video conferencing

Working from home with pets or kids around? HandsOff protects you during Zoom, Google Meet, or Teams calls:

- Lock your input while staying visible on camera.
- Use the Talk hotkey to unmute without unlocking.
- Your cat can walk across the keyboard without causing chaos.
- Auto-lock ensures you are protected even if you forget to lock.

### Presentations and screen sharing

When sharing your screen:

- Lock input to prevent accidental clicks or key presses.
- Keep your presentation flowing without interruption.
- Unlock instantly when you need to interact again.
- Works well for demos, training sessions, and client meetings.

### Leaving your laptop unattended

Need to step away but want to keep monitoring something?

- Lock input while keeping your screen visible.
- Monitor long-running processes, builds, or deployments.
- Watch a video conference continue while you grab coffee.
- Protect against accidental touches in public spaces.

### Long-running builds and agent sessions

Lock input while a coding agent runs tests or a build. The screen stays readable, so you can watch output land, and stray keystrokes cannot interrupt the session.

## Getting started

HandsOff ships as an ad-hoc signed DMG.

1. Download the arm64 or x86_64 DMG from [GitHub Releases](https://github.com/mhuang74/handsoff-rs/releases).
2. Drag `HandsOff.app` to `/Applications`.
3. Right-click and choose Open on first launch, then confirm the Gatekeeper prompt.
4. Grant Accessibility permissions in System Settings.
5. The Setup Wizard opens automatically on first run.

The menu-bar icon is red when locked. The menu has Lock Input, Preferences, Change Passphrase, Reset, Fix Accessibility Permission, Check for Updates, Help, and Quit. All mouse clicks are blocked while locked, so unlocking is passphrase-only.

## Security

HandsOff stores your passphrase as a hash of the physical keycodes you press. That works with any keyboard layout, and nothing readable touches disk.

Other details:

- Config file readable only by your user account.
- No network connections or telemetry.
- All data stays local on your device.
- Auto-unlock defaults to 60 minutes, doubling to 24 hours. Only a passphrase unlock resets it.

HandsOff guards against casual interference, not a determined local actor who can reboot, kill the app, or take the machine.

## Built with Rust

HandsOff is written in Rust for performance, safety, and native macOS integration. It uses CoreGraphics event taps for reliable input blocking and integrates cleanly with macOS's Accessibility framework.

The project is open source and available on [GitHub](https://github.com/mhuang74/handsoff-rs). Contributions welcome.

---

Requires macOS 13 (Ventura) or later. Tested on a MacBook Air M2. License is in the GitHub repo.
