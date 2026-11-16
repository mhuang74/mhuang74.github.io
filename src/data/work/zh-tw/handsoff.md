---
title: "HandsOff"
role: "創作者兼工程師"
team: 獨立開發
stack:
  - Rust (CoreGraphics event taps, CFRunLoop)
  - AppKit / menu-bar UI
  - GitHub Actions (macOS CI, DMGs)
outcomes:
  - "鎖住鍵盤和滑鼠，螢幕維持可見"
  - "修掉一個吃滿單一 CPU 核心的背景迴圈"
  - "支援 Apple Silicon 與 Intel Mac，附引導式設定"
featured: false
pubDatetime: 2026-10-06
description: "一個 macOS 選單列工具，鎖住鍵盤與滑鼠、螢幕保持可見，讓你能盯著 coding agent 跑，不用擔心好奇的小孩來亂。"
translationOf: handsoff
sourceUpdated: 2026-10-06
---

我做 [HandsOff](https://github.com/mhuang74/handsoff-rs) 只有一個理由。coding agent 現在會在我的機器上跑很久的任務，而我想在它們跑的時候看著螢幕。鎖螢幕會把我想看的輸出藏起來。所以實際上，我常把筆電開著不鎖，然後我家最小的那個就做了好奇小孩會做的事。（這是我其中一個 Rust 專案，所以有點過度工程。這也是樂趣的一半。）

HandsOff 在系統層級擋掉鍵盤、觸控板和滑鼠。螢幕完全保持可見。解鎖時要盲打一組通關語：沒有回顯、沒有游標。它防的是日常的干擾——小孩在鍵盤上亂按、同事、螢幕分享的觀眾。有心人要破解，直接重開機或把機器帶走就好。把它想成行李箱的號碼鎖，不是銀行金庫。

打造它的過程教了我幾件事。

**復原路徑必須比 bug 更便宜**

擋掉整台機器的輸入，代表一個 bug 就可能讓使用者完全無法打字。可靠的復原必須從一開始就是設計的一部分。所以我設計時預想的故障情境不是「有人繞過鎖」，而是「我自己的 bug 把鍵盤綁架了」。

**失效時要開，而且要講清楚**

如果 HandsOff 在執行時被撤銷「輔助使用」權限，它會解鎖、發出通知說明怎麼修，然後結束。在沒有把握能解除鎖定的情況下還去鎖輸入，是比根本不鎖更糟的結果。

**比對鍵碼，不是字元**

通關語是盲打的。沒有提示、沒有游標，任何回饋都沒有。HandsOff 比對的是實體按鍵，所以通關語不受鍵盤配置影響，而且永遠不會以可讀形式儲存。

**自動解鎖勝過把自己鎖死**

忘記通關語不該讓整個工作階段報廢。定時自動解鎖會給使用者一條回頭路，等待時間逐次拉長，直到他們用通關語解鎖為止。忘記了，就是等一下，而不是永久失去存取權。

**每次更新都會弄壞你自己的權限授權**

我沒有付費的 Apple Developer 帳號，所以發行版是 ad-hoc 簽章。更新之後，macOS 可能顯示「輔助使用」已開啟，但實際上已經失效。使用者需要重置並重新授權。發布方式也很土炮：一個 DMG，加上 Gatekeeper 的右鍵跳舞，沒有公證、沒有自動更新器。

**一個應用程式，一個介面**

我把終端機式的安裝流程換成應用程式內的設定精靈。權限授權、通關語設定和偏好設定，現在都住在真正需要這些權限的應用程式裡。

**先刪掉死掉的執行緒，再刪掉依賴它的東西**

有個背景執行緒一直在空轉，沒做什麼有用的工作，卻吃掉一整個 CPU 核心。把它移除之後，我也順便簡化了應用程式的控制項。完整的偵探故事在[打造 HandsOff 教我怎麼帶 coding agent](/zh-tw/posts/handsoff-steering-coding-agents)那篇。

**Agent 寫程式，人類顧 Mac**

大部分程式碼和測試都是 coding agent 寫的，它們也很會讀 log。但 macOS 不讓它們截取視窗畫面或模擬點擊，所以 GUI 行為、權限和 CPU 使用量，我還是自己在那台 Mac 上檢查。

HandsOff 提供 Apple Silicon 和 Intel Mac 的 DMG。

原始碼與發行版：[mhuang74/handsoff-rs](https://github.com/mhuang74/handsoff-rs) · [releases](https://github.com/mhuang74/handsoff-rs/releases)。安裝說明在[產品文章](/zh-tw/posts/handsoff)裡。
