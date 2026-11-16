---
title: "原生客戶端：用同一套 API 的 Android 應用"
author: Michael Huang
pubDatetime: 2026-09-08T00:00:00Z
modDatetime: 2026-11-06T00:00:00Z
slug: sow-android-client
featured: false
draft: false
tags:
  - stream-of-worship
  - android
  - kotlin
description: "原生影片播放、cookie 工作階段，以及由 Android 管理的下載。"
translationOf: sow-android-client
sourceUpdated: 2026-11-06T00:00:00Z
---

我想要一支接上大螢幕的手機能有原生播放器：下載交給 Android 管，影片畫面由我直接控制。後端在網頁應用那個時候就已經有了，所以 Android 應用可以直接用同一套 JSON API 和簽章過的媒體網址。

這樣目錄和渲染邏輯就只存在一個地方。不過它也把一些平常由瀏覽器幫我處理掉的假設攤開來，尤其是 cookie 和登入轉址。

這是 [《Stream of Worship》系列](/zh-tw/posts/sow-intro)的一部分。上一篇：[離線敬拜播放](/zh-tw/posts/sow-offline-playback)。下一篇：[十個開發階段](/zh-tw/posts/sow-retrospective)。

<!-- more -->

## 先從同一個來源開始

應用用 OkHttp，加上一個[持久化的 cookie 儲存](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/android/app/src/main/java/org/streamofworship/android/core/session/SessionCookieStore.kt)。它會先試加密的 preferences，如果加密初始化連續失敗兩次，就退回一般的應用私有 preferences。行程死掉之後 cookie 還是能還原。啟動時的驗證狀態判斷，得避免在還原完成前，就把一個偶然出現的 unauthorized 回應當成最終答案。

Cookie 仍然綁在主機上。模擬器的 `10.0.2.2`、電腦的區網位址、部署好的應用網域，三者不能互換。如果登入成功但下一個請求卻 unauthorized，先檢查設定的來源網址通常很有用。

[Android README](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/android/README.md) 有寫這段設定。我手上沒有客服統計數字，可以支撐「主機設定不符是最常見的使用者問題」這種說法。

## 影片頁面自己擁有播放器

敬拜頁面用的是 [VideoExoPlayerFactory](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/android/app/src/main/java/org/streamofworship/android/feature/player/VideoExoPlayerFactory.kt) 建出來、跑在同一個行程裡的 ExoPlayer。它直接接上影片畫面，處理耳機拔出的廣播事件，啟用解碼器備援，並使用網路喚醒模式。

程式庫裡還有一個 [MediaSessionService](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/android/app/src/main/java/org/streamofworship/android/feature/player/SowPlaybackService.kt)（SowPlaybackService）。它的註解明白寫著目前的影片頁面沒在用它；留著是為了之後可能做背景音訊。它存在，不代表敬拜頁面就能透過那個服務提供背景播放或鎖定畫面控制。

生命週期的變化要特別小心。存活下來的 view model 可能還握著一個 controller，而舊 activity 的播放器早就被釋放了。播放相關的修正會重新綁定作用中的 controller。這是一個具體的生命週期問題，不是「播放能撐過每一次螢幕關閉或行程死亡」的證明。

## 章節與歌詞

客戶端會讀渲染工作產生的章節 sidecar，先正規化再使用。播放位置決定目前是哪一首歌、哪一行歌詞。點一行歌詞可以跳轉，章節切換則帶動比較大的捲動位移。

MP4 裡本來就有歌詞，所以這個面板只是操作的輔助。讓章節時間軸跟渲染出來的混音對齊，比在手機上複製一份渲染器的版面還重要。

簽章網址會過期。客戶端用裝置時鐘檢查到期時間，並為過期的網址提供重新整理的途徑。本機檢查只有在時鐘正確時才算是方便；網址到底有沒有效，還是由伺服器決定。

## 讓 Android 負責下載檔案

[下載排程器](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/android/app/src/main/java/org/streamofworship/android/core/download/AndroidArtifactDownloadScheduler.kt) 直接呼叫 DownloadManager。它允許計量連線，不允許漫遊，並要求完成通知。這條路徑不是 WorkManager 的下載 worker。

中繼資料會分別追蹤每一個成品。影片可能已經好了，章節檔卻失敗。協調器在排入佇列之前就先存好佇列中的中繼資料；而如果完成事件比下載 ID 的儲存還早到，完成接收器可以從標題反推渲染工作 ID 和成品種類。

[離線儲存庫](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/android/app/src/main/java/org/streamofworship/android/data/offline/OfflineCacheRepository.kt) 寫入中繼資料時，會先寫一個同層的暫存檔再做替換。壞掉的中繼資料會讀成空的。這樣能保護啟動流程不被壞檔案拖垮，不過索引不見了，並不代表每個下載過的成品都救得回來。

[協調器測試](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/android/app/src/test/java/org/streamofworship/android/core/download/ArtifactDownloadCoordinatorTest.kt) 和[儲存庫測試](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/android/app/src/test/java/org/streamofworship/android/data/offline/OfflineCacheRepositoryTest.kt) 涵蓋了這些邊界。裝置的網路、HDMI 輸出、解碼器行為，還是得靠實機測試。CI 會產出 debug APK；release 簽章仍然是另一件待辦。
