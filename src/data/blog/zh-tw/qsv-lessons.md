---
title: 參與 QSV 教我的事
author: Michael Huang
pubDatetime: 2022-03-29T00:00:00Z
slug: qsv-lessons
featured: false
draft: false
tags:
  - rust
description: 用第一個真正的專案學 Rust
translationOf: qsv-lessons
sourceUpdated: 2022-03-29T00:00:00Z
---

我算是不得不學 Rust，因為我 C/C++ 爛得可以。玩 Arduino 複製貼上那段有趣的階段一過，對微控制器的著迷終究把我丟回大學時代的 C/C++ 惡夢。Java/Scala/Python 我可以，但要怎麼在 C/C++ 裡好好處理字串，我還是完全沒概念。所以 Rust 算是我的救生艇。

而為了學 Rust，我得做一個真的專案。失敗了幾次之後，我撞見一個很精緻的小專案 [xsv](https://github.com/BurntSushi/xsv)，能用飛快的速度 JOIN csv 檔。有點像我們工作上用 Spark 做的事，只是濃縮成一個小小的 CLI 工具。後來我找到唯一還活躍的 fork [qsv](https://github.com/jqnatividad/qsv)，由友善的 Joel 維護，就決定跳進去。

以下是我第一個真正的 Rust 專案學到的幾件事。

**不需要 Rust 除錯器**

我花了幾天想讓 LLDB 和 GDB 的除錯流程跑起來。報酬太小了。我確定總有一天會需要那麼強大的工具，但以我簡單、偶爾的需要來說，`dbg!()` 就夠了。

**rustfmt 是朋友，clippy 是導師**

剛開始幾個 PR 收到一些抱怨，因為我不習慣跑 `cargo fmt`。`cargo clippy` 也一樣。後來我發現，只要事後跑 rustfmt，我的空白和縮排就可以隨便一點。而 clippy 讓我覺得有位私人導師站在背後，盯著我寫的新手 Rust 程式碼。

**存檔時跑 Cargo Check**

我曾經把 cargo-check-on-save 關掉一陣子，因為筆電幾乎被它做的工作凍住。後來我讀了 [Zero to Production in Rust](https://algoluca.gumroad.com/l/zero2prod) 的第一節，決定再試一次，好降低感受到的編譯時間。對我的生產力來說是天壤之別！改完之後編譯錯誤馬上出現，還在 VS Code 裡直接標在原始碼旁。

**升級編譯器沒關係**

我不記得在 Java 或 Python 的世界裡這麼常升編譯器。新的 Rust 版本發布才幾天，qsv 就會用上新的語言特性，我被迫升級 Rust 才能編譯。有 Rustup，升級就是會動。

**Rust 愛記憶體**

用大陣列 `[u8]` 而不是 vector `Vec<u8>`，很容易超過預設 2MB 的堆疊大小。

而且因為 Rust 運作得太好，有時我們會忘記，去載入超大檔案把硬體 RAM 吃光。竟然沒有 segmentation fault，真神奇。

**Serde 慢，Clone() 也慢**

Serde 在 Rust 裡用得極廣。方便是有代價的。快的程式碼要避開 serde。

到處撒 `clone()` 大概是消掉借用檢查器錯誤最簡單的方法。但代價可能出現在效能上。寫正確的 Rust，不要動不動就 clone()。

**Rayon 與串流資料**

看起來 Rayon 的平行處理沒辦法用在串流資料上，因為資料是一筆一筆到的。我從 [More Stina Blog!](https://morestina.net/blog/1432/parallel-stream-processing-with-rayon) 學到，串流資料可以先分批，然後 Rayon 的平行迭代器照常輾過去。
