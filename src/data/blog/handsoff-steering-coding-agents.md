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
description: "A macOS input locker built so a coding agent's progress stays readable with a toddler at the keyboard, plus three runtime failures that only showed up on the machine."
---

The reason I wrote HandsOff is narrow. Coding agents run long builds and long test suites, and I want to read the screen while they run. I have a toddler. Screen lock and the screensaver hide the screen, which defeats the whole point of watching, so I kept leaving the machine open and kept losing work to small hands on the keyboard.

[HandsOff](https://github.com/mhuang74/handsoff-rs) blocks the keyboard, trackpad, and mouse at the system level while leaving the display fully visible, and you unlock by typing a passphrase blind, with no echo and no cursor. The threat model is spelled out in the [README](https://github.com/mhuang74/handsoff-rs/blob/main/README.md): it guards against casual interference, a child, a colleague, or the audience of a screenshare. It isn't a barrier against a determined local actor, who can reboot the machine, kill the app, or simply carry the laptop away. That framing decided everything downstream. For a tool whose job is blocking input, a bug that leaves input blocked is worse than the problem it solves, so the fail-closed path had to be designed before the happy path.

**What shipped**

HandsOff is a native menu-bar app for macOS 13 and later, written in Rust, sitting on a CoreGraphics event tap. There is a Setup Wizard on first run, a global hotkey for lock and another for Talk, auto-lock at 180 seconds by default, and auto-unlock that opens a window at 60 minutes and doubles from there up to 24 hours, reset only by a real passphrase unlock. The passphrase is stored as a SHA-256 hash over the physical keycode sequence, so it is layout-independent and nothing readable sits on disk.

The project reached v0.10.0 through 167 commits, 19 tagged releases, 140 tests, 22 specs, and 5 ADRs. The first agent-authored commit in the history is titled "first rev from Claude". Everything after it came out of a loop where I wrote specs and the agent wrote code, and the machine decided which of us was right.

**The part the code can't tell you**

An agent can read every line in this repo and still be wrong about what the process does. That isn't a knock on the reading. It's the shape of the problem. Here the agents could run commands and read logs, which covers a lot of ground.

What they couldn't do was look at the screen, click a button, or watch a core count. The repo's [AGENTS.md](https://github.com/mhuang74/handsoff-rs/blob/main/AGENTS.md) says it plainly: macOS TCC denies agents window screenshots and synthetic clicks, so no menu automation through System Events. Accessibility grants bind to the resolved binary path, which means a debug build in `target/debug` can't be granted in place at all. Verification of the GUI and TCC paths is human-run by construction, not by anyone's policy preference. So the bugs that mattered lived in the part of the loop I own, and the agent's job was to make my part cheap.

**A 500 ms sleep that never slept**

The static review found a dead background thread and priced it at 2 wakeups per second (`specs/deep-design-review-2026-09.md`, finding P-4). Deletion was the right call, and the review said so. The price was wrong by orders of magnitude.

Activity Monitor showed `handsoff-tray` at about 100% of one core, steady, whether or not I touched the machine. A 5 second `sample` of the live release binary, 3,737 samples at 1 ms, put 2,999 of them in `start_cfrunloop_thread`. The main thread was parked in `mach_msg` inside `[NSApplication run]`, which is where it belongs, because that is the loop servicing the event tap.

```rust
loop {
    let result = unsafe {
        CFRunLoop::run_in_mode(kCFRunLoopDefaultMode,
                               Duration::from_millis(CFRUNLOOP_POLL_INTERVAL_MS), // 500 ms
                               false)
    };
    if shutdown_rx.try_recv().is_ok() { break; }
    ...
}
```

| Thread                     | Samples busy |
| -------------------------- | ------------ |
| main (`NSApplication run`) | 2 / 3737     |
| `start_cfrunloop_thread`   | 2999 / 3737  |

The root cause is in [`specs/cpu-spin-cfrunloop-thread-2026-10.md`](https://github.com/mhuang74/handsoff-rs/blob/main/specs/cpu-spin-cfrunloop-thread-2026-10.md). `CFRunLoopRunInMode` returns `kCFRunLoopRunFinished` immediately when the run loop has no sources in the mode. It doesn't honor the duration as a sleep. The thread's run loop owned zero sources, since the tap attaches its source to the main thread's loop, so every iteration returned at once and the loop called it again as fast as the CPU allowed. The code comment said "run the loop for 0.5 seconds" and nobody had tested the sentence.

The fix was to delete the thread, v0.9.1, PR #46. Deleting the spin also removed the only rationale for the Disable/Reenable menu pair, which was a "minimal CPU mode" flag, so those went too in v0.10.0 (PR #47, ADR 0005). The agent was directionally right and off by four orders of magnitude. The correction came from a measurement, not from reading the code harder.

**The button that always cancelled**

The stale-TCC escape hatch existed for a specific wall: after an update replaces the ad-hoc signed binary, the old Accessibility row stays lit in System Settings while both real checks fail, and the wizard waits on "grant" forever. So the wizard offered a Reset Permission & Restart button.

The code compared `alert.runModal()` against `NSModalResponseOK`, which is 1. NSAlert buttons do not return 1. The first returns 1000 (`NSAlertFirstButtonReturn`) and the second 1001, so the branch never fired and the button always cancelled. It compiled, it read correctly, and it shipped. Only a click proved it, and the click was mine to run.

The fix compares against `NSAlertFirstButtonReturn` and landed in v0.9.0. The general lesson is that framework return-value semantics are runtime facts. Reviewing that diff harder wouldn't have found it, because nothing in it was wrong in a way reading can see.

**The lock that locked the user out**

The setup wizard used to start the passphrase-capture tap the moment Accessibility was granted. That tap swallows every keydown system-wide, which is exactly its job, except nothing on screen said so and the timeout was 300 seconds. Every relaunch repeated it, because the wizard opens again. On the day I chased it, 16 stacked wizard launches were observed, each holding its own swallow tap. That's the failure I said at the top I couldn't tolerate, committed by the tool built to prevent it.

The fix is architectural rather than cosmetic. Capture starts only when you click **Capture Passphrase**, is bounded to 120 seconds with a visible countdown, and aborts within one 100 ms pump slice when the window closes. A single-instance `flock` keeps a second tray from ever stacking on the first. Then the policy call, in ADR 0005: runtime permission revocation now unlocks, shows one notification, and quits, so a broken permission state releases input instead of holding it hostage.

Write down the failure you cannot tolerate before writing the code. It changes the design, not just the test list. Mine was "never leave input blocked", and every obsolete feature after it, including Disable/Reenable, fell out of taking that sentence seriously.

**How I steer**

**Define the failure first.** The unacceptable outcome goes in the spec as a sentence, not as an implication of the architecture.

**Turn runtime claims into acceptance criteria.** Name the command and the number: `sample handsoff-tray 5`, an idle CPU target, "no `start_cfrunloop_thread` thread on top of the sample", lock then type then unlock.

**Feed back observations, not opinions.** The agent gets sample output, log lines, and exact return codes in a form it can read. "It feels slow" isn't a bug report, and "the modal probably returns something else" wasn't a fix until it was 1000.

**Keep the human steps explicit.** The CPU spec names the on-device steps because agent GUI verification is blocked, and the setup wizard notes which flows need a release build in the TCC-approved path. Anything I leave implicit comes back as a stalled agent.

**Correct the model, not just the patch.** The interception hang assessment first scored the tap teardown as a HIGH wrong-runloop use-after-free. Verification of the call graph, that add and remove both use `CFRunLoop::get_current()` from the main thread, disproved it and downgraded the finding to LOW (`docs/assessment-interception-hang-risk-2026-10.md`, revision note). Getting the mental model right was worth more than any single patch in that document.

For engineers, the honest accounting is that agents compress implementation and hardly touch problem definition. Mine read every line here and still needed a `sample` to learn what the process was doing. For hiring managers, the deliverable is not the app. It is the app plus the loop that got it there: written specs, measurable acceptance criteria, and the discipline to go run the thing.

Source and releases are at [mhuang74/handsoff-rs](https://github.com/mhuang74/handsoff-rs) and its [releases page](https://github.com/mhuang74/handsoff-rs/releases). For install instructions, the [product post](/posts/handsoff) is still the one to read.
