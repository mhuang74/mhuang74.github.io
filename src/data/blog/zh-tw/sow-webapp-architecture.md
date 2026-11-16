---
title: "網頁應用：在手機上準備一組歌"
author: Michael Huang
pubDatetime: 2026-08-11T00:00:00Z
modDatetime: 2026-11-06T00:00:00Z
slug: sow-webapp-architecture
featured: false
draft: false
tags:
  - stream-of-worship
  - nextjs
  - aws
  - web
description: "把編輯和渲染分開、輪詢等完成，再把影片送到電視。"
translationOf: sow-webapp-architecture
sourceUpdated: 2026-11-06T00:00:00Z
---

在手機上準備一組歌，意味著挑歌、送出渲染，然後拿到一支能在比較大的螢幕播放的影片。編輯器要反應很快。把整場聚會編碼起來卻可能要花好幾分鐘。

這給了我一個好用的分工：網頁應用負責收下工作、追蹤進度，另一個 worker 負責產出檔案。它們共用一個資料庫和物件儲存，送出和渲染之間隔著一個佇列。

這是[《Stream of Worship》系列](/zh-tw/posts/sow-intro)的一部分。上一篇：[歌曲組建構器](/zh-tw/posts/sow-songset-constructor)。下一篇：[離線敬拜播放](/zh-tw/posts/sow-offline-playback)。

<!-- more -->

## 一個後端，幾種 client

Next.js 應用程式同時服務瀏覽器工作階段和 JSON API。Android 也用同一批 API。Cast receiver 不一樣：它需要一個能播的媒體網址，但不能要求它登入應用程式。

[認證 proxy](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/webapp/src/proxy.ts)會把未登入的頁面請求轉到登入頁，但對受保護的 API 請求回 JSON、狀態 401。API handler 自己還是會檢查授權和擁有者。公開分享和投影的路由有各自不同的存取路徑。

這個區別很小但必要。一個期待 JSON 的原生 client，拿到 HTML 登入頁什麼也不能做，而轉址成功不等於 API 回應成功。[proxy 測試](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/webapp/src/test/proxy.test.ts)把這個差別寫清楚了。

目錄的中繼資料、錄音、歌曲組、渲染任務都放在 Postgres。文字搜尋用標題、拼音和 credits。相似歌曲是用存下來的嵌入向量找。我不會把這些講成一個通用的混合搜尋系統：這幾條檢索路徑服務的是不同的請求。

## 送出任務，之後再讀一次

[渲染端點](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/webapp/src/app/api/render-jobs/route.ts)會驗證請求、檢查存取權與額度、寫入一筆任務，然後派送。派送失敗就把任務標成失敗。有一道進行中任務的防護，避免同一組歌又疊上另一個渲染；卡住的舊任務可以被校正，而不是永遠擋著。

[派送器](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/webapp/src/lib/render/dispatcher.ts)支援 SQS 和 REST 模式。預設是 SQS。它送的是任務、歌曲組、使用者的識別碼，不是序列化過的歌曲清單。

[worker 管線](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/render-worker/src/sow_render_worker/pipeline.py)會讀資料庫、抓來源素材、混音、渲染影片、上傳產物，再更新任務。在執行時才讀計畫，可以避免訊息裡多帶一份序列化的副本，但也代表這則訊息不是送出當下那組歌的不可變快照。

## 這個畫面用輪詢就夠了

[送出後的畫面](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/webapp/src/components/render/RenderSubmitted.tsx)每十秒輪詢一次。暫時性的抓取錯誤不會動到任務，等下一輪就好。401 或 403 會停止輪詢並請使用者登入；那不代表渲染失敗。404 或 410 就結束這個畫面對該任務的追蹤。

README 裡還列著一個 SSE 事件端點，但這個版本裡沒有那條路由。這裡有用的參考是 client 的實作和它的[測試](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/webapp/src/test/components/render/RenderSubmitted.test.tsx)。我會把過期的說明刪掉，而不是讓讀者自己猜哪種傳輸方式還活著。

## 給電視一個抓得到的檔案

登入後的控制器會產生一個 presigned 儲存網址，傳給 Cast receiver。歌詞是直接燒進 MP4 的，所以那個 receiver 不需要目錄、也不需要使用者的 cookie。控制器為 Cast 播放要的是四小時有效的網址，好留時間給設定和一場聚會。

章節資料是透過應用程式的 proxy 以 JSON sidecar 送進來。這樣瀏覽器拿章節資料時，不必依賴跨來源的儲存抓取。編碼支援和網路連線仍然要緊；程式沒辦法保證每一台電視、每一個場地的網路都能用。

對一場事先準備好的聚會，下一步是[離線播放](/zh-tw/posts/sow-offline-playback)。四小時有效的網址在有網路時很好用。下載下來的副本則需要另一條啟動和交付路徑。
