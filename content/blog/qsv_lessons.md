+++
title = "What contributing to QSV taught me"
description = "Learning Rust with my first real project"
date = 2022-03-29
draft = false

[taxonomies]
categories = ["Learnings"]
tags = ["rust"]
+++

I kinda had to learn Rust, because I sucked at C/C++ so badly. Once beyond the fun phase of copy-and-paste Adruino programming, my fascination with microcontrollers inevitably threw me back into the C/C++ nightmare of my college years. I could do Java/Scala/Python, but still clueless about how to properly manipulate strings in C/C++. So Rust was kinda my lifeboat.

<!-- more -->

And in order to learn Rust, I had to do a real project. After a few false starts, I stumbled upon a neat little project called [xsv](https://github.com/BurntSushi/xsv) that can JOIN csv files with blazing speed. Kinda like what we use Spark for at work, except condensed into one tiny CLI tool. Eventually I found the one active fork called [qsv](https://github.com/jqnatividad/qsv) maintained by friendly Joel and decided to jump in.

Here are a few takeaways from my very first real Rust project.

__No need for Rust Debugger__

I sunk in a few days trying to get LLDB and GDB debugging flow working. The payoff was too small. I am sure I would need such powerful tools someday, but for my simple and occasional needs, `dbg!()` is enough.


_rustfmt is a Friend, and clippy is a Mentor__

I received some complaints for my first few PR's because I wasn't used to running `cargo fmt`. Same with `cargo clippy`. Then I found that I could be sloppy with my whitespaces and indentations as long as I run rustfmt later. And clippy made me feel like having a personal mentor standing over my shoulders to check my newbie Rust code.

__Cargo Check on Save__

I had disabled cargo-check-on-save for a while because my laptop would almost freeze with all the work it's doing. Then I read the first section of [Zero to Production in Rust](https://algoluca.gumroad.com/l/zero2prod) and decided to give it another try in order to decrease perceived compilation time. It made a night and day difference to my productivity! Compilation errors appear immediately after making changes, all visually annotated right with the source in vscode.

__It's Okay to Upgrade the Compiler__

I don't ever remember upgrading the compiler so frequently in Java or Python land. Just a few days after new Rust release, qsv would actually pick up new Rust language features, and I would be forced to upgrade my Rust version in order to compile. With Rustup, it just worked.


__Rust likes Memory__


It's easy to go over default stack size of 2MB with large arrays `[u8]` instead of vectors `Vec<u8>`.

And because Rust works so well, sometimes we forget and try to load really large files that exhausts hardware RAM. It's amazing that there's no segmentation fault!


__Serde is Slow, and so is Clone()__

Serde is used pervasively in Rust. Convenience is costly though. Fast code needs to avoid serde.

Sprinkling `clone()` around is probably the easiest way to silence borrow-checker errors. But payment may come due in terms of performance. Write correct Rust code without resorting to clone().


__Rayon and Streaming Data__


It would seem that Rayon parallel processing wouldn't work with streaming data because data would be arriving one at a time. I learned from [More Stina Blog!](https://morestina.net/blog/1432/parallel-stream-processing-with-rayon) that streaming data can first be put into batches, then Rayon parallel iterator can plow through them as usual.






