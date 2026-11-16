---
title: "離線敬拜播放：連播放器一起下載"
author: Michael Huang
pubDatetime: 2026-08-25T00:00:00Z
modDatetime: 2026-11-06T00:00:00Z
slug: sow-offline-playback
featured: false
draft: false
tags:
  - stream-of-worship
  - web
  - offline
description: "把渲染好的成品快取起來、回應位元組範圍請求，讓下載過的歌曲組在沒有網路的情況下也能開始播放。"
translationOf: sow-offline-playback
sourceUpdated: 2026-11-06T00:00:00Z
---

下載好的敬拜歌曲組，應該在沒有 Wi-Fi 的時候也能開始播放、一路播下去。把 MP4 存下來只是其中一部分。瀏覽器還需要播放器頁面、它的腳本，以及足夠的中繼資料，才找得到正確的檔案。

拖動進度條讓這個需求更有意思。video 元素會發出位元組範圍請求，所以 service worker 也得從存下來的檔案回應這些請求。

這是 [《Stream of Worship》系列](/zh-tw/posts/sow-intro)的一部分。上一篇：[網頁應用](/zh-tw/posts/sow-webapp-architecture)。下一篇：[原生客戶端：用同一套 API 的 Android 應用](/zh-tw/posts/sow-android-client)。

<!-- more -->

## 位元組與記帳

[Cache Storage](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/webapp/src/lib/offline/artifact-cache.ts) 用渲染工作 ID 推導出來的固定鍵，存放完整的音訊、影片與章節回應。IndexedDB 存的是歌曲組名稱、工作 ID、成品旗標和下載時間。

解析器會先檢查實際的快取，才宣告一組歌曲可以播放。瀏覽器把位元組清掉之後，索引裡的旗標仍可能留著。要求持久儲存空間有幫助——前提是瀏覽器肯給；這個要求本身也可能失敗或被拒絕。

目前的預算輔助函式在估計來源儲存空間用量達到 500 MiB 時發出警告，用量已經至少 1 GiB 時就拒絕新的快取操作。它不會替即將寫入的檔案保留空間，也證明不了下載一定放得下。[快取測試](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/webapp/src/test/lib/offline/artifact-cache.test.ts) 涵蓋的是已實作的檢查，不是「瀏覽器不會清掉」的保證。

## 回應範圍請求

[service worker 處理常式](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/webapp/public/sw-artifact-serving.js) 把成品代理網址對應到存下來的回應。合法的範圍會回傳狀態 206，加上主體裡的一段切片。起點超出身長尾端的範圍回傳 416。不支援或格式錯誤的範圍語法，則退回完整的回應。

快取沒命中時，處理常式會不帶 Range 標頭去要一整個檔案。只有完整的 200 回應才會被存下來；半個檔案不能佔用一個承諾「整支影片」的鍵。這些情況都有[範圍服務測試](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/webapp/src/test/lib/offline/sw-artifact-serving.test.ts) 顧到。

這樣一來，快取過的影片拖動進度條時就不用再回儲存層拿資料。不過它仍然依賴瀏覽器讀得到那份快取主體；從查索引到真的播放之間，儲存空間是有可能消失的。

## 準備冷啟動

[下載輔助函式](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/webapp/src/lib/offline/download-offline.ts) 取得代理網址、要求持久儲存空間、快取成品，然後寫入索引。接著它會試著存下控制器和敬拜清單這兩個頁面。[文件輔助函式](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/webapp/src/lib/offline/document-cache.ts) 還會順便預熱它們相依的腳本、樣式和字型。

它會拒收被重新導向的回應或登入頁的回應，免得過期的工作階段把登入頁 HTML 快取在播放器網址下面。下載來的控制器頁面走的是另一條路由，不受一般頁面快取到期策略的管轄。

這裡有個限制：索引寫入和文件預熱都是盡力而為。媒體可能下載完了，但冷啟動離線開啟所需的那些工作卻失敗。下載成功的通知本身，並不代表整套離線流程都行得通。我會在實際播放的裝置上，把網路關掉，試著打開存好的歌曲組。

## 優先使用下載的那一份

目前的[播放核心](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/webapp/src/hooks/usePlaybackCore.ts) 就算在線上，也會先看有沒有可用的下載副本。找到的話，播的就是那個快照。若作業系統明確回報離線，它不會發出任何啟動時的 API 呼叫。否則它會走線上那條鏈，遇到可回復的失敗再退回快取。

這個決定是針對單次啟動做的，而不是連線狀態一變就重啟播放器。如果線上媒體之後才失敗，核心會用離線副本做一次復原嘗試。恢復播放時，播放器會保留失敗當下的位置。

本機快照會綁在它自己的渲染工作上。之後的編輯或重新渲染不會改動已下載的位元組，所以更新副本是另一個獨立動作。

## 驗證確立了什麼

[九月的復原交接文件](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/reports/handover_offline_drop_recovery.md) 記錄了一次強制觸發媒體錯誤的測試：切換到快取播放，然後繼續播下去。它也記下一個重要的注意事項——把網路斷掉不見得每次都重現得了失敗，因為 Chromium 的 HTTP 快取還可能繼續把影片送出來。

那份報告裡的靜態資源問題，是開發環境的 chunk 網址固定不變、結果混著不同 build 在送。那不是「不可變的正式環境資源普遍壞掉」的證據。不過有些離線導覽的檢查，確實還是被那個開發環境的水合（hydration）問題影響。

[快取優先的交接文件](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/reports/offline-worship-simplification-handover.md) 同樣回報單元檢查和 build 都過了，但那份交接當時還有好幾個瀏覽器情境沒做完。這些紀錄支援復原設計，但不足以證明每台目標裝置都能可靠離線播放。這一段，我還是想靠真實瀏覽器的檢查來回答。
