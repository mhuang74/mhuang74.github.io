---
title: "MCC GAQL Tool"
role: "創作者兼維護者"
team: 獨立開發
stack:
  - Rust (workspace, edition 2024)
  - tonic gRPC
  - Polars
  - rig-core / FastEmbed
  - LanceDB + Arrow
  - Cloudflare R2
outcomes:
  - "跨連結的 Google Ads 帳戶查詢廣告活動指標，並用自然語言產生 GAQL。"
featured: false
pubDatetime: 2026-09-28
description: 用 Rust 寫的命令列工具，可查詢多個 Google Ads 帳戶、套用已核准的變更，並從自然語言產生 GAQL。
translationOf: mcc_gaql_rs
sourceUpdated: 2026-09-28
---

## 問題

透過管理員（MCC）帳戶管理 Google Ads 的代理商和分析師，整天都活在 GAQL 裡，但工具很薄。官方 client library 很笨重，現有的 CLI（這個專案受 getyourguide/gaql-cli 啟發）不會跨子帳戶展開查詢，而叫 LLM「寫一個 GAQL 查詢」，只會產生幻想出來的欄位名稱，執行時失敗，還浪費 API 額度。

目標：一套給分析師用的快速終端機優先工具組——一次查很多帳戶、安全地做變更，並從自然語言產生正確的 GAQL。

## 限制

1. **GAQL 的 schema 很大，而且有版本。** 任何產生工具都需要對應確切 API 版本的中介資料，而不是模型訓練資料裡的版本。
2. **帳戶存取和 API 變更需要持續照顧。** 認證必須在本機和 SSH 連線下都能用，請求有用量限制，API 版本也經常變動。
3. **基本查詢應該保持輕量。** 分析師不該只為了跑一個查詢，就得安裝整套產生工具。

## 決策

- **依任務拆開工具。** `mcc-gaql` 負責查詢，`mcc-gaql-mut` 負責變更，`mcc-gaql-gen` 則從自然語言產生查詢。查詢和變更工具保持輕量；產生工具另外發布，連同它需要的檢索堆疊一起帶。
- **讓產生有 API 中介資料當地基。** 產生器會從 API schema 檢索欄位和資源資訊，以及相關的範例查詢。分析師可以檢查欄位為什麼被選中，而不是相信一個沒有解釋的答案。
- **把連結的帳戶一起查。** 跨子帳戶的並行查詢，可以在某個帳戶失敗時繼續跑。結果可以跨帳戶分組和排序，不必匯出到 notebook。
- **跟上前端 API 的變化。** 自動化的上游檢查會偵測 API 變更、驗證遷移，並開 pull request 給人審。
- **發布可直接執行的執行檔。** macOS 和 Linux 版本可透過 GitHub releases 取得。

## 成果連結

- 程式庫：[mhuang74/mcc-gaql-rs](https://github.com/mhuang74/mcc-gaql-rs)

## 成果

- 自然語言查詢大約 3–4 秒就能產生 GAQL。
- 已用於三個 Google Ads 帳戶，產出每月成效報表。
