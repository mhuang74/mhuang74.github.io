---
title: "跑起分析服務：Modal 應用程式與背景工作"
author: Michael Huang
pubDatetime: 2026-11-06T00:00:00Z
modDatetime: 2026-11-06T00:00:00Z
slug: sow-analysis-infrastructure
featured: false
draft: false
tags:
  - stream-of-worship
  - machine-learning
  - python
  - infrastructure
description: "一個 CPU 協調服務、五個 Modal GPU 應用程式，以及把分析接到目錄的任務與批次復原路徑。"
translationOf: sow-analysis-infrastructure
sourceUpdated: 2026-11-06T00:00:00Z
---

我想處理一批錄音，又不想把每個模型都一直載在服務機器上。我也想能關掉 Admin CLI，過一陣子再回來，查出哪些結果還沒進到目錄。

歌詞與分析那幾篇文章背後的工作，都由 Analysis Service 處理。它的 CPU 容器負責接收任務、管理狀態、協調遠端模型。Admin CLI 則挑選目錄裡要做的工，並把回傳的結果存起來。這是兩塊不同的責任，復原路徑也各自獨立。

這是[《Stream of Worship》系列](/zh-tw/posts/sow-intro)的一部分。上一篇：[分析歌曲：速度、調性、段落與意義](/zh-tw/posts/sow-analysis-pipeline)。下一篇：[轉場引擎](/zh-tw/posts/sow-transition-engine)。

<!-- more -->

## 一個協調者，五個 GPU 應用程式

主容器跑 FastAPI、佇列、librosa 量測、快取存取，還有各家外部服務的 client。它已經不再背著本地的 torch、allin1、Demucs、Whisper 模型堆疊。Qwen3 ASR 和文字 API 也都算外部服務。

[Modal 應用程式](https://github.com/mhuang74/stream_of_worship/tree/01dae04a94f01747e954f5fd079d20fe230987e7/ops/analysis-service/modal_apps)把 GPU 工作這樣切：

| 應用程式             | 主要工作                               | 為什麼要自己的映像檔                  |
| -------------------- | -------------------------------------- | ------------------------------------- |
| `sow-analyzer`       | allin1 結構分析與內部的 Demucs 分離    | 完整的音樂分析相依套件                |
| `sow-downbeats`      | 用 madmom-infer 算獨立的節拍／重拍格線 | 只要格線的請求不需要 allin1 或 Demucs |
| `sow-stems`          | 人聲／伴奏分離與人聲去殘響             | 分離模型與相依套件不同                |
| `sow-whisper`        | faster-whisper 轉錄                    | 語音辨識模型堆疊                      |
| `sow-forced-aligner` | Qwen3 給定文字對齊                     | 對齊模型堆疊                          |

五個都會跟 Modal 要 L4 GPU，每個最多開兩個容器，在我看的那個 checkout 裡 scaledown 視窗是 300 秒。這是每個應用程式各自的上限，不是全域只能有兩張 GPU。analyzer 和 stem 那兩個應用程式要 4 個 CPU、16 GiB RAM；downbeats 要 4 個 CPU、8 GiB。

[Modal 遷移 PR](https://github.com/mhuang74/stream_of_worship/pull/263)記錄了這次拆分背後的記憶體與相依套件問題。裡面也留著早期的部署細節，所以要看確切設定，還是以目前的映像檔定義為準。

## 相依套件與冷啟動還是要緊

把推論搬出服務機器，並不會讓相依套件的工消失。analyzer 要釘住互相相容的 torch、NATTEN、allin1、Demucs 版本，補掉一個 import 對不上的地方，並在建置時檢查 import。它的啟動預熱用的是有聲音的音檔，因為對這套堆疊來說，靜音是很糟的熱身輸入。

有四個應用程式用 Modal 的具名 volume 存模型權重。冷容器可以直接用已經下載好的權重，但還是得把模型載起來。比較輕的 downbeats 映像檔是在啟動時把驗證過的權重抓進容器快取，沒有用同樣的持久化 volume 做法。就算模型很小，能避開完整的 analyzer 映像檔還是值得。

每個輸入的逾時和啟動逾時是分開的。比較大的應用程式容許每個輸入跑到 1,800 秒；downbeats 是 600 秒。這些是保險絲，不是預期的單曲處理時間。熱的請求和縮容後的第一個請求，行為可以差很多。

## 重試之前先把工作量圈起來

佇列預設把完整分析和 LRC 執行各限制在兩個並行任務。快速分析和元件抽取有各自的 CPU 並行上限，嵌入向量任務則有五個名額的 semaphore。LLM 的節奏控制和供應商限制又是另外幾層。只用一個批次並行設定，沒辦法好好表達這些不同的資源。

Modal 的容器上限是另一道邊界。推論重試由 client 負責，app 類別不會再加一層重試策略，這樣才不會把 client 的嘗試次數乘上平台的嘗試次數。設定錯誤（例如部署根本不存在）跟遠端暫時性故障，需要不同的處理方式。

client 也負責準備 payload、把 request ID 記進 log。完整分析、Whisper、強制對齊在 Modal 掛掉時，不會偷偷退回本地模型推論。跑完適用的重試策略之後，任務就是可以失敗。

分離音軌那條路不一樣。主要走 MVSEP；額度用完可以等重置，非額度的重試用完才轉去 Modal。如果 MVSEP 已經產出人聲和伴奏，只有去殘響失敗，那就只有第二階段需要 Modal 備援。[分離 worker](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/analysis-service/src/sow_analysis/workers/stem_separation.py)保留了這個區別。它沒有容器內的模型備援。

## 任務狀態活得比 process 久

[佇列](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/analysis-service/src/sow_analysis/workers/queue.py)把進行中的狀態放在記憶體，並用 SQLite 做備份。一個任務包含它帶型別的請求、結果或錯誤、時間戳、狀態、階段、進度。`queued`、`waiting`、`processing` 分別代表等著派送、已經分到 task、真的在跑。

階段名稱描述當下在做什麼，例如下載中，或是在等分離人聲的子任務。進度是回報的分數比例，不是剩餘時間的預測。卡在等額度的任務，實際花的時間可能比先前進度看起來的久很多。

啟動時，服務會重新載入排隊中的任務，並把被中斷的處理中、等待中任務重新排進佇列。它會重跑這些任務的 worker 流程；不會把中斷到一半的模型推論接回去。產物快取可以讓重播便宜一點。持久化的測試涵蓋了狀態轉移，但沒有保證外部工作只會被執行一次。

取消有它的極限。排隊中的工作可以直接跳過，有些 worker 會在等待時或進到下一階段前檢查取消。取消一個處理中的任務只會把它標成已取消，並警告它正在跑的 task 可以繼續到服務重啟為止。這不是把遠端 GPU 砍掉，也不會回滾已經做完的上傳。

啟動清理會刪掉超過七天的終態任務。進行中的任務不會被這條規則清掉。SQLite 是好用的操作歷史，但它不是目錄永久保存來源紀錄的地方。

## 快取的產物有另一個生命週期

分析結果、節拍格線、歌詞、分離音軌、元件，都可以不靠任務紀錄獨立重複使用。完整分析會把 `analysis.json` 上傳到 R2；元件處理可以上傳 `components.json`；歌詞和分離音軌各有自己的物件。快速分析只留一份本地的結果，不會上傳完整分析的 manifest。

帶版本的快取鍵用來區分不同演算法與分析等級。完整分析快取命中又指定要分離音軌時，四條快取音軌都在就直接沿用；缺的就得再叫一次 analyzer 補回來。所以快取命中並不保證每個選用產物都拿得到。

寫入方式並不統一。快速結果和節拍格線是先寫暫存檔再替換，完整分析、LRC、元件 JSON 則是直接寫。版本控制能避免重用到舊演算法的輸出；它本身不會保護被中斷的寫入。

## 從一個批次到目錄

[Admin CLI 的批次指令](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/admin-cli/src/stream_of_worship/admin/commands/audio.py)可以用 ID、專輯、狀態篩選或標準輸入挑歌。步驟旗標決定要做下載、歌詞、分析、嵌入向量、元件。分析等級預設是 fast；要 full 得自己選。`--all-steps` 會補上缺的工作，包含結構化歌詞回填和元件。

決定好用哪個錄音和哪些輸入之後，CLI 會對對應的 `/jobs/...` 路由送出帶認證的 HTTP 請求。回應會給一個任務 ID。服務把請求存下來，在相關資源限制下派送 worker，並開出可以輪詢的狀態。

CLI 會在多個進行中的任務之間交錯輪詢，這樣一首做完了就能往前推進，其他還在跑。它把回傳的量測值和狀態寫進目錄的錄音，存下歌曲與逐行的嵌入向量，並 upsert 元件紀錄。錄音層級的主題／姿態聚合也在這裡做。服務端任務結束和目錄更新，是兩件不同的事。

批次 manifest 記錄歌、錄音的 hash 前綴、步驟、等級、任務 ID、狀態。這跟 R2 上的分析產物是兩回事。中斷時，CLI 會把 manifest 寫出去，讓 `--resume` 能接回還沒結束的任務 ID，而不是整個批次再盲送一次。

resume 會跳過終態的項目，對已完成的重試一次冪等的目錄回寫，並把還活著的項目放回輪詢迴圈。它不會自動把每個失敗項目都重跑一遍。如果服務已經把任務清掉，光有任務 ID 也救不回結果。快取產物和目錄同步可能還有幫助，但我會趁任務紀錄還在的時候就 resume 一個批次。
