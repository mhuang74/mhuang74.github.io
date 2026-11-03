---
title: "What building HandsOff taught me about steering coding agents"
author: Michael Huang
pubDatetime: 2026-10-06T00:00:00Z
featured: false
draft: false
tags:
  - rust
  - macos
  - building
description: "I built a macOS input locker so I can watch my coding agent work with kids in the house. Three bugs only showed up on the machine, and they changed how I steer agents."
---

I built HandsOff for one reason. Coding agents can now run long tasks, and I want to read the screen while they run. Screen lock hides the screen, which defeats the point of watching. So I kept the machine open, and I lost work to small curious hands on the keyboard. My youngest was in kindergarten then.

[HandsOff](https://github.com/mhuang74/handsoff-rs) blocks the keyboard, trackpad, and mouse at the system level. The display stays visible. You unlock by typing a passphrase blind. No echo, no cursor. It guards against casual interference: a kid at the keyboard, a colleague, the audience of a screenshare. A determined attacker reboots the machine or walks off with the laptop, so it's more of a simple luggage combo lock than a sophisticated vault lock.

That framing drove the design. For a tool that blocks input, a bug that locks the keyboard and won't let go is immediate fail. So I left open an auto-unlock fail-safe rather than guaranteeding the lock to be super strong. Ergonomics over unnecessary features.

## What it does

HandsOff is a native menu-bar app for macOS 13 and later, written in Rust. A system hook intercepts every keystroke. You get a setup wizard on first run, a global hotkey to lock, auto-lock at 180 seconds by default, and auto-unlock that opens a window at 60 minutes and doubles from there up to 24 hours. Only a real passphrase unlock resets it.

The app stores your passphrase as a one-way hash of the physical keycodes you press. That works with any keyboard layout, and nothing readable touches disk.

Though I've created Rust CLI and libraries before, I've not done system-level programming, and especially not GUI related tools on MacOS. This was my first fully vibe-coded project. I wrote specs, the agent wrote code, and the machine decided who was right.

## What the agent can't see

Handsoff worked well enough for me to use, but for a long time, not stable enough for me to share with people. An agent can read the code, but not understand the system instability I see through mouse cursor stutters and millisecond typing delays.

So the bugs that mattered showed up enough times for me to see a pattern and raise suspicision, and as the model got smarter over the months, the agent finally used my problem description to disset the problem, collaborated with me to gather more run-time data, and solved the root cause hidden beneath layers of slop written by earlier models.

## The sleep that never slept

It started as system slowness after running HandsOff for weeks. So I asked agent to introduce a Suspend Mode to minimize polling and thus CPU usage. The sleep-then-check loop got inserted at this point, but de-generated into a source of CPU drain after further optimizations along the way. Slop bug.

Static review found a dead background thread and priced it at 2 wakeups per second. Deleting it was the right call. The price was wrong by about 10,000 times.

Activity Monitor showed `handsoff-tray` pinned at a full core whether I touched the machine or not. Sampling the live release binary put nearly all its time in that thread. The main thread sat asleep.

The loop, verbatim:

```rust
loop {
    let result = unsafe {
        CFRunLoop::run_in_mode(kCFRunLoopDefaultMode,
                               Duration::from_millis(500), // "sleep" half a second
                               false)
    };
    if shutdown_rx.try_recv().is_ok() { break; }
    ...
}
```

It's ironic that the intended design had opposite results at run-time. The app asked the system to wait half a second before checking again. With nothing to wait on, the run loop answers instantly. So the thread asked again, and again, as fast as the CPU allowed. The comment said "run the loop for 0.5 seconds". Nobody tested that sentence.

The fix deleted the thread. Deleting it also killed the reason for a "minimal CPU mode" menu pair, so those went too. The agent got the direction right and the size wrong. A measurement corrected it. No amount of reading finds that bug.

## The button that always said no

After an update replaces the app file, the macOS permission screen still shows the old entry lit up while both real checks fail. The wizard waits on "grant" forever. So I added a Reset Permission & Restart button.

The button never worked. The code compared the dialog's answer against the wrong constant. It checked for 1. The first button returns 1000. The branch never fired, and clicking always cancelled.

It compiled. It read correctly. It shipped. Only a click exposed it, and the click was mine to run. No amount of review catches this, because nothing in the diff looks wrong.

## The lock that locked me out

This one was serious, but broke the Installation wizard and not the main usecase. The wizard used to listen for your passphrase the moment permission came through. That listener swallows every keystroke on the machine, which is its job. Except nothing on screen said it was happening, and it stayed that way for up to 300 seconds. Quit and relaunch, and the wizard does it again.

The afternoon I chased this down, I counted 16 stacked wizard launches. Each one held the keyboard hostage. I didn't think to build an escape hatch for installer bugs.

The fix touched the design, not the cosmetics. Capture starts only when you click the Capture Passphrase button. It runs at most 120 seconds with a countdown on screen, and it stops within a tenth of a second when you close the window. A lock file keeps a second copy off the first. The policy changed too: if the permission breaks while the app runs, it unlocks, shows one notification, and quits. A broken permission releases the keyboard. It never holds it hostage.

Write down the failure you cannot accept as soon as you think of it and make it a hard constraint. It shapes the design, not just the test list. I added "never leave input blocked" in AGENTS.md after this lesson.

## How I steer the agent now

A few takeaways.

Define the failure first. Put the unacceptable outcome in AGENTS.md and in the specs. Make it a hard constraint the agent can't ignore.

Turn runtime claims into acceptance criteria. Name the command and the number: `sample handsoff-tray 5`, an idle CPU target, lock then type then unlock.

Feed the agent observations, not opinions. Sample output, log lines, exact return codes. "It feels slow" is not a bug report. "The dialog probably returns something else" was not a fix until we knew the real number.

Keep the human steps explicit. Anything you leave implicit about on-device verification comes back as a stalled agent.

Question the model assumptions, not just review the PR. One review flagged a high crash risk in the input-hook teardown. Walking the real call graph killed it. The feared chain never happens. Getting the mental model right beat any patch in that review.

My youngest is past kindergarten now. The keyboard is safer. HandsOff still earns its keep each time a kid wanders over to "help". The agent did nearly all of the typing, and it typed fast. Deciding what "broken" means, writing it down, and running the thing to see who was right: that part stayed with me. It stays with whoever holds the keyboard.

Source is at [mhuang74/handsoff-rs](https://github.com/mhuang74/handsoff-rs). Install instructions live in the [product post](/posts/handsoff).
