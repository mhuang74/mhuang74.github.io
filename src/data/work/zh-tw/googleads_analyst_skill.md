---
title: "GoogleAds Analyst Skill"
role: "設計者兼作者"
team: 獨立開發
stack:
  - Claude Agent Skills
  - mcc-gaql CLI suite
  - prompt engineering
  - pandoc / weasyprint
outcomes:
  - "產出標出異常、可換上自家品牌的 Google Ads 成效報表。"
featured: false
pubDatetime: 2026-09-28
description: 一個 Claude agent skill，讓 Google Ads 成效分析、變更歸因與使用者核准後的帳戶更新可以重複執行。
translationOf: googleads_analyst_skill
sourceUpdated: 2026-09-28
---

## 問題

問 LLM「我的 Google Ads 帳戶最近怎麼樣？」，你會得到一份看起來很合理、卻毫無紀律的報表：憑空捏造的指標、分不清*你改了什麼*和*市場發生了什麼*，而且從「問題在這裡」到「解法在這裡」之間沒有安全的路。分析師需要的是一套可重複的方法，不是憑感覺。

目標：把 Claude 變成一位 Google Ads 成效分析師，遵循真正的研究流程，而且能在帳戶擁有者完全不會被突襲的前提下，執行自己的建議。

## 限制

1. **LLM 會幻想 GAQL 欄位名稱。** `metrics.video_views` 和 `metrics.video_trueview_views` 看起來都對，跑起來卻會失敗。
2. **歸因是困難的分析問題。** 調價之後轉換下滑，和帳戶完全沒有動作卻同樣下滑，是兩件不同的事。
3. **變更幾乎不可逆。** 暫停廣告活動可以救回來；刪掉就沒了。寫錯比不寫更糟。
4. **Token 預算。** 一個把整套方法論都塞進上下文的 skill，不只慢，還會拖累模型的注意力。

## 決策

- **執行前先驗證查詢。** 每個 GAQL 查詢都必須先通過 `mcc-gaql --validate` 對照 API 中介資料，才能在帳戶上執行。這能在幻想出來的欄位名稱碰到帳戶之前就攔下來。
- **需要時再載入指引。** skill 會隨著每個階段需要，才載入對應的分析指引，讓初始上下文保持精簡。
- **把異常和帳戶變更放在一起比對。** 時間點、症狀吻合度、幅度和影響範圍，可以幫忙分辨是帳戶變更造成的，還是外部因素。
- **寫入前一定要核准。** skill 會先檢查目前狀態、預覽變更、請使用者核准確切的動作、套用，再驗證結果。不可逆的移除有額外的防護。
- **Grants 帳戶要另外處理。** Google Ads Grants 帳戶有不同的花費和資格限制。專用的門檻可以避免分析師把 Grants 的正常行為當成危機。

## 成果連結

- 程式庫：[mhuang74/googleads-analyst-skill](https://github.com/mhuang74/googleads-analyst-skill)
- 搭配的 CLI：[mcc-gaql-rs](/zh-tw/work/mcc_gaql_rs) 提供查詢、驗證、產生和變更工具

## 成果

自 2025 年起每月使用：為三個 Google Ads 帳戶產出每月成效報表。
