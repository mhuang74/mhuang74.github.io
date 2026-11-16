---
title: 建立歌曲目錄：一次爬取多個來源也不會亂的歌曲 ID
author: Michael Huang
pubDatetime: 2026-06-02T00:00:00Z
modDatetime: 2026-11-06T00:00:00Z
slug: sow-catalog
featured: false
draft: false
tags:
  - stream-of-worship
  - python
  - data-engineering
description: 爬歌曲表、把歌曲和錄音分開，還有修好第一次 ID 遷移。
translationOf: sow-catalog
sourceUpdated: 2026-11-06T00:00:00Z
---

在能實驗敬拜歌曲組之前，我得先有一份目錄。[讚美之泉的歌曲頁](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/admin-cli/src/stream_of_worship/admin/services/scraper.py)把我要的文字大多放在同一張表裡。比較難的問題是：表格變動時，要怎麼辨識一首歌。

最早的 ID 含有列號。上游插一列，下次爬取時 ID 就可能跟著變，所以那些號碼不適合讓錄音和歌曲組拿來當參照。

這是[《Stream of Worship》系列](/zh-tw/posts/sow-intro)的一部分。上一篇：[為什麼無縫敬拜轉場這麼難](/zh-tw/posts/sow-why-transitions-are-hard)。下一篇：[同步歌詞：產生與對齊](/zh-tw/posts/sow-lyrics-pipeline)。

<!-- more -->

## 爬這張表

爬蟲會先找 `tablepress-3`，再用中英文關鍵字比對表頭。這樣欄位順序換了也還能撐。表格或歌詞欄不見會直接報錯；其他欄位缺了可能就是空的，單列失敗會記進 log 然後跳過。但這不是完整的檢查，無法保證上游頁面的意思還是我以為的那樣。

歌詞要多花點心思。解析器要同時處理正常的換行標籤，還有夾著巢狀文字的畸形標籤。單純抓儲存格文字，行與行會黏在一起。爬蟲會先把標籤換掉或拆掉，再把文字切成一行一行。它輸出的段落仍然只有一個 `unknown` 段落；音樂結構是後面分析才補上。

[爬蟲測試](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/admin-cli/tests/admin/test_scraper.py)涵蓋解析，[ID 穩定性測試](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/admin-cli/tests/admin/services/test_scraper_id_stability.py)涵蓋欄位重排和重複的情況。它們檢查的是存下來的 HTML 範例，所以線上頁面真的變了，還是得另外查。

## 兩種身分

現在歌曲的 ID 來自歌名、作曲和作詞。這個 [ID 輔助函式](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/admin-cli/src/stream_of_worship/admin/services/catalog_edit.py)會先去頭尾空白、對這幾個欄位做 NFKC 正規化，把合併後的文字雜湊，再接上八個十六進位字元到拼音 slug 後面。整個 ID 上限 100 個字元。

這樣列順序再怎麼換，ID 都不會變。但它沒辦法讓 ID 不受 metadata 更正的影響，也證明不了兩筆掛不同作者的資料就是不同的作品。雜湊很短，所以我不該把「唯一」講成數學上的保證。

拼音的部分，羅馬化之前會把 祢 和 禰 換成 你，讓歌名用 `ni` 而不是套件給的 `mi`。原始歌名不動。

錄音有另一個獨立的身分：下載回來的音訊位元組的 SHA-256。[下載器](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/admin-cli/src/stream_of_worship/admin/services/youtube.py)會搜 YouTube、正規化候選標題，並檢查長度，以避開一些組曲和特別長的結果。雜湊對得上，可以在上傳前先抓到重複。但它證明不了搜尋找到的是正確的那個演出。

## 第一次遷移

[4 月 28 日的遷移交接文件](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/reports/handover_db_migration_song_ids.md)記了 685 首歌，其中 104 首對到重複的 ID。修復時保留最早的那筆舊資料當標準，重複的做軟刪除，最後剩 581 首有效歌曲。事後 21 筆錄音的歌曲參照全部有效。這些是那次遷移的數字，不是今天的目錄大小。

失敗的那個指令先更新了 `recordings.song_id`，才去更新父表的 `songs.id`。在外鍵開啟的情況下，新的父資料那時還不存在。目標 ID 重複是另一個問題。

修復用的是一次性腳本，操作期間關掉外鍵檢查，並透過暫存 ID 做兩輪改名。交接文件記錄了結果；修復腳本本身沒有進版控。所以這場操作能從原始碼重現的程度有限。

## 目錄調性只是參考資料

[7 月 3 日的稽核](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/reports/key_detection_algorithm_review.md)拿偵測到的根音去比目錄的根音：98 筆可比對的錄音裡有 75 筆相符，76.5%。它忽略大小調、排除兩筆資料缺漏的，並把等音異名當成一樣。目錄的調性本身也不保證就是標準答案。

這對改進偵測器是有用的證據，但它不是通用的調性偵測準確率。把目錄的 metadata 和錄音分析分開存，意見不同時我才能重新檢視，兩邊的資料都不會掉。

這個專案的教訓是：列順序用起來很方便，但依賴它的代價很高。下次我會在第一次匯入之前就先把身分欄位定好。
