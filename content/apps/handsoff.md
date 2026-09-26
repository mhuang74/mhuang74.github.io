+++
title = "HandsOff - Protection from little fingers and paws"
description = "A macOS utility to lock keyboard/mouse while leaving the screen viewable"
date = 2025-11-14

[taxonomies]
categories = ["Tools"]
tags = ["Building"]
+++

Have you ever been on a video call when your cat walks across your keyboard, sending embarrassing gibberish to your colleagues? Or had your toddler "help" with your presentation by clicking everything in sight? HandsOff is a native macOS utility that solves these problems by blocking all keyboard, trackpad, and mouse input while keeping your screen fully visible.

<!-- more -->

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
- **Auto-Lock**: Automatically locks after 30 seconds of inactivity (configurable)
- **Talk Hotkey**: Press `Ctrl+Cmd+Shift+T` when locked to pass through a spacebar press for unmuting in video calls
- **Microphone & Camera**: Video conferencing apps continue to work normally - the lock only affects input devices
- **Two Modes**: Native menu bar app (recommended) or CLI for advanced users

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

### 4. SSH Remote Access Safety

Use HandsOff CLI via SSH to remotely lock a laptop while keeping the screen viewable for others in the room. If needed, SSH back in to unlock or reconfigure.

## Getting Started

HandsOff is available in two forms:

### Menu Bar App (Recommended)

The native macOS menu bar application provides the best user experience:

1. Download the PKG installer from [GitHub Releases](https://github.com/mhuang74/handsoff-rs/releases)
2. Run the installer (installs to `~/Applications/HandsOff.app`)
3. Grant Accessibility permissions in System Settings
4. Run setup to configure your passphrase:
   ```bash
   ~/Applications/HandsOff.app/Contents/MacOS/handsoff-tray --setup
   ```
5. Start the app: `launchctl start com.handsoff.inputlock`

The menu bar icon shows your lock status (red when locked) and provides quick access to lock, disable, or reset.

### CLI (Advanced Users)

For terminal enthusiasts or remote usage:

1. Download the CLI tarball from [GitHub Releases](https://github.com/mhuang74/handsoff-rs/releases)
2. Extract and install: `sudo mv handsoff /usr/local/bin/`
3. Run setup: `handsoff --setup`
4. Start: `handsoff`

The CLI provides more control over configuration and is perfect for remote/headless usage via SSH.

## Security

HandsOff takes security seriously:

- Passphrases stored encrypted using AES-256-GCM
- Config file readable only by your user account (600 permissions)
- No network connections or telemetry
- All data stays local on your device
- Auto-unlock safety timeout option to prevent permanent lockouts

## Built with Rust

HandsOff is written in Rust for performance, safety, and native macOS integration. It uses CoreGraphics event taps for reliable input blocking and integrates cleanly with macOS's Accessibility framework.

The project is open source and available on [GitHub](https://github.com/mhuang74/handsoff-rs). Contributions welcome!

---

**Requirements**: macOS 10.11 (El Capitan) or later
**Tested on**: MBA M2 with macOS 15.7 (Sequoia)
**License**: See LICENSE file on GitHub
