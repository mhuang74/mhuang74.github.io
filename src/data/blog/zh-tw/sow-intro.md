---
title: Stream of Worship 系列
author: Michael Huang
pubDatetime: 2026-05-05T00:00:00Z
modDatetime: 2026-11-06T00:00:00Z
slug: sow-intro
featured: false
draft: false
tags:
  - building
  - stream-of-worship
description: 介紹「Stream of Worship」系列：一套讓中文敬拜詩歌無縫轉場的系統
translationOf: sow-intro
sourceUpdated: 2026-11-06T00:00:00Z
---

我想讓小組敬拜的流暢度更接近主日聚會。但當我們手上只有 YouTube 上有歌詞的影片時，歌曲之間常常出現尷尬的空白。中間可能被廣告打斷。下一首歌又起在不同的調性。英文敬拜的工具有很多，中文敬拜詩歌我卻幾乎找不到。我要怎麼找出彼此相容的歌曲，再為整組歌做出一支歌詞影片？

[Stream of Worship](https://streamofworship.com) 就是我對這件事的嘗試。它會分析歌曲、在歌與歌之間產生轉場，並渲染音訊與歌詞影片。想法很簡單：給它一份歌單，拿回一組可以連續播放、也能離線播放的敬拜歌曲組。

這是系列文章的第一篇，談它是怎麼蓋起來的。

<!-- more -->

## 它做什麼

給定一組中文敬拜詩歌，我想讓它們連續播放，每首歌自然流進下一首，而不是硬生生停下來。

主要有四個部分：

1. 建立目錄。爬蟲收集歌曲目錄，用內容雜湊辨識重複的音檔。共用的資料庫存紀錄，音檔和渲染出來的檔案放物件儲存。
2. 分析錄音。一個服務大量使用 GPU 找出速度、調性、歌曲段落與分軌。歌詞管線會嘗試幾個不同來源，產出 LRC 檔。
3. 規劃歌曲組。轉場引擎檢查歌曲接合處的音樂邊界，而不是依賴整首歌的平均值。一個 AI 代理程式提出符合固定五階段敬拜弧線的歌曲順序。
4. 渲染歌曲組。一個無伺服器 worker 對音訊做交叉淡化，並渲染帶同步歌詞的影片。網頁應用提供編輯、播放、投影、搜尋和離線支援。另外還有一個原生 Android 用戶端。

我希望帶小組敬拜的領袖可以：

- 瀏覽、發掘，並試聽有歌詞的歌曲
- 用歌曲組的音訊版本，帶大家認識不熟的歌
- 產生歌詞影片，歌詞在對的時間點換行
- 在沒有網路的情況下播放已下載的歌詞影片
- 透過 Chromecast 把歌詞投到大螢幕電視上
- 把歌詞影片分享到社群媒體

## 目前進度

到目前為止，我大概推進了十個開發階段。

- 目錄、音訊和分析管線都能運作了。
- 網頁應用是主要介面。

後面的文章會談已下載歌曲組的離線播放，以及用同一組 API 的原生 Android 用戶端。我還想繼續做很多東西：更好的轉場、混合式語意搜尋、影片模板市集，以及中文以外的語言支援。

## 系列文章

以下是文章規劃，大致照管線順序排：

1. [為什麼無縫敬拜轉場這麼難](/zh-tw/posts/sow-why-transitions-are-hard)。
2. [建立歌曲目錄](/zh-tw/posts/sow-catalog)。
3. [同步歌詞：產生與對齊](/zh-tw/posts/sow-lyrics-pipeline)。
4. [分析歌曲：速度、調性、段落與意義](/zh-tw/posts/sow-analysis-pipeline)。
5. [跑起分析服務：Modal 應用程式與背景工作](/zh-tw/posts/sow-analysis-infrastructure)。
6. [轉場引擎](/zh-tw/posts/sow-transition-engine)。
7. [歌曲組建構器](/zh-tw/posts/sow-songset-constructor)。
8. [網頁應用架構](/zh-tw/posts/sow-webapp-architecture)。
9. [離線敬拜播放](/zh-tw/posts/sow-offline-playback)。
10. [走向原生：Android 用戶端](/zh-tw/posts/sow-android-client)。
11. [十個開發階段：Stream of Worship 教我的事](/zh-tw/posts/sow-retrospective)。

回顧之後還有一篇：[Detector 2.0.0：挑出有問題的中文敬拜歌詞](/zh-tw/posts/lrc-detector-2-0-0)。它講我怎麼檢查這些管線產出的歌詞有沒有錯。

大部分文章談我目前做了什麼、哪裡壞掉，以及我學到什麼。程式碼是開源的。如果你想在自己的小組試試看，[使用指南](https://streamofworship.com)有說明怎麼組出一組歌。

下一篇：[為什麼無縫敬拜轉場這麼難](/zh-tw/posts/sow-why-transitions-are-hard)。
