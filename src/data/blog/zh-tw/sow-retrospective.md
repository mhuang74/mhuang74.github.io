---
title: "十個開發階段：Stream of Worship 教我的事"
author: Michael Huang
pubDatetime: 2026-09-22T00:00:00Z
modDatetime: 2026-11-06T00:00:00Z
slug: sow-retrospective
featured: false
draft: false
tags:
  - stream-of-worship
  - building
  - retrospective
description: "哪些我會保留、哪些我會簡化，以及哪些結果還需要靠聽感測試來確認。"
translationOf: sow-retrospective
sourceUpdated: 2026-11-06T00:00:00Z
---

我想把做完 Stream of Worship 之後會留下的東西寫下來，也寫下如果重來一次我會改什麼。這個專案現在涵蓋目錄匯入、分析、歌詞、歌曲組建構、渲染和播放。讓這些環節彼此對得上，比任何單一演算法都花力氣。

十個階段的大綱是跟著看建置過程的好方法：CLI 與 schema、目錄爬取、音訊下載、分析工作、CLI／服務整合、歌詞產生、資料庫遷移、網頁應用、渲染 worker，還有 Android。它不是工時統計，也不表示每個階段都在下一個開始之前就完成了。

這篇文章是 [《Stream of Worship》系列](/zh-tw/posts/sow-intro)的一部分。上一篇：[原生客戶端：用同一套 API 的 Android 應用](/zh-tw/posts/sow-android-client)。下一篇：[Detector 2.0.0：先挑出該優先檢查的歌詞檔](/zh-tw/posts/lrc-detector-2-0-0)。

<!-- more -->

**把歌曲和錄音分開**

歌曲有書目層級的身分。錄音則有一份音訊位元組的雜湊值。把兩者分開，分析和儲存就有一個穩定的參照，即使目錄的中繼資料需要修正也不會亂。

[4 月 28 日的遷移紀錄](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/reports/handover_db_migration_song_ids.md) 正好提醒為什麼這件事重要：685 筆變成 581 首有效歌曲和 104 筆軟刪除的重複項，之後 21 個錄音參照全部有效。這些是遷移當時的計數，不應該跟後來的審查或下載次數混在一起，當成同一份目前的目錄快照。

內容雜湊也沒有解決所有的快取問題。模型版本、提示詞版本、輸出 schema 各自還是需要自己的失效規則。

**把判斷和解釋分開**

建構器不用模型也能搜尋和排序。模型寫的解釋不是提案能不能通過的原因。這個切分我會留著。

[7 月 26 日的範例](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/eval/run1_standard/songset_review.md) 在沒有 LLM、放寬階段覆蓋率的情況下，從 438 個候選裡生出五個提案。它證明的是搜尋跑得動，不是會眾比較喜歡那樣的輸出。在把分數進步當成產品進步之前，我還是需要聽感上的回饋。

邊界評分也是同樣的道理。拿出口和入口來比較很有用，但缺 BPM 和不確定的調性還是會進到規則裡。看起來很精確的分數，可能藏著不完整的輸入。

**用大家真正需要的介面**

程式庫裡留著一個舊的 CLI／TUI、後來的一個使用者版 TUI，還有網頁應用。終端工具對操作和檢視管線很有用。但如果對象是要準備敬拜歌曲組的人，我會把手機流程放在第一順位。

我也會早一點就選定共用的資料庫。專案從 SQLite 儲存搬到 Postgres，管理工具、網頁應用和渲染 worker 各有各的客戶端。CLI 不只是個 HTTP 客戶端：它仍然直接做資料庫和儲存操作。Android 才是那個乖乖待在 web API 後面的客戶端。

**換掉能用的工具之前，先做基準測試**

[6 月 20 日的備份基準測試](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/reports/admin-r2-backup-rclone-download-v1-results.md) 沒有達到從 boto3 換成 rclone 的門檻。它單一連線的 boto3 診斷跑到 7.85 MiB/s；測過的 rclone 設定都比較慢，所以原本要動的正式環境變更就停在那裡。

報告把這稱為帳戶層級的上限。這些測量確實顯示瓶頸在那個客戶端和網路路徑上，但沒辦法把 Cloudflare 的帳戶政策從路徑的其他環節裡單獨分離出來。決定我會留著，但解釋要收窄：在那次測試裡，rclone 對這個工作負載沒幫助。

**檢查真正跑起來的那條路**

網頁客戶端每十秒輪詢一次渲染狀態，而 README 列了一條根本不存在的 SSE 路由。Android 的程式庫裡有一個目前影片頁面沒在用的背景播放服務。渲染器存下了調性移調和速度比例，卻兩個都沒套用。

這三件事都讓系統只看表面更難懂。沒被套用的渲染設定對使用者影響最大：一個存下來的移調可以通過規劃規則，音訊卻完全沒變。我會先解決這個，再談加新的推薦功能。

**替花錢的實驗標上日期**

[10 月 20 日的尾段補救執行](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/reports/tail-lyrics-recovery-report.md) 在 22 個工作裡總共補了 43 行。Qwen3 在那些又短又重複的結尾上常常不能用，本機的 Whisper 補回了其中大部分的行。這份報告是從 log 推出來的，包含一次中斷的嘗試，也沒有辦法確立每一行補進去的歌詞都正確。

十月下旬，Whisper 和完整分析搬到了 Modal。所以舊的計時資料描述的是更早的部署，不是管線現在的成本。分析服務現在負責指揮遠端的模型；它不是那台包辦所有 GPU 工作的機器。

**測試下載後的流程**

瀏覽器的下載不只需要媒體位元組。播放器頁面和腳本也得活得下來，而且有些準備工作仍然是盡力而為。Android 走 DownloadManager 那條路，生命週期和中繼資料的顧慮都不一樣。我會繼續把它們當成兩套流程分別測。

接下來我會收集人工對渲染轉場的評分、修掉渲染器忽略的那些控制項，並把離線冷啟動變成可重複的實機檢查。音色和副歌層級的接點搜尋是有意思的加分項，但我想先知道：領袖們多常接受比較簡單的輸出。

專案開源在 [mhuang74/stream_of_worship](https://github.com/mhuang74/stream_of_worship)。[原始碼快照](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/README.md) 和[系列簡介](/zh-tw/posts/sow-intro)有專案地圖。[使用者指南](https://streamofworship.com) 涵蓋了怎麼準備一組歌曲。
