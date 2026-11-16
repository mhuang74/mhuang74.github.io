---
title: "轉場引擎：比較出口與入口"
author: Michael Huang
pubDatetime: 2026-07-14T00:00:00Z
modDatetime: 2026-11-06T00:00:00Z
slug: sow-transition-engine
featured: false
draft: false
tags:
  - stream-of-worship
  - audio
  - design
description: "邊界特徵、和聲建議，以及渲染器實際套用了什麼。"
translationOf: sow-transition-engine
sourceUpdated: 2026-11-06T00:00:00Z
---

我需要把一個錄音的結尾和下一段錄音的開頭拿來比。歌曲在目錄裡的調性和平均速度是好用的捷徑，但它們可能描述的是轉場裡錯的那一段。

轉場程式會建議一段間隔、交叉淡化，以及可能的移調。渲染是另一個步驟，而且有些存下來的設定根本還沒影響到音訊。在試聽一組建議的歌單時，這個區別很重要。

這是[《Stream of Worship》系列](/zh-tw/posts/sow-intro)的一部分。上一篇：[跑起分析服務：Modal 應用程式與背景工作](/zh-tw/posts/sow-analysis-infrastructure)。下一篇：[歌曲組建構器](/zh-tw/posts/sow-songset-constructor)。

<!-- more -->

## 要比哪些量測

[元件聚合](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/admin-cli/src/stream_of_worship/admin/songset_constructor/components.py)會讀標記為 `entry`、`exit`、`entry_exit` 的紀錄。如果符合的紀錄不只一筆，就用出現次數索引和 row ID 做一個確定的選擇。它不會去找每一個可能的接點。

調性方面，[成對比較](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/admin-cli/src/stream_of_worship/admin/songset_constructor/rules/transitions.py)只在兩邊都有元件估算值時才用元件估算。否則兩邊都退回歌曲層級的估算。這樣可以避免在同一次比較裡混用兩種調性來源。

速度的退回機制比那句話聽起來有限。在元件調性的配對裡，缺一個邊界 BPM 會退回那首歌的 BPM，並發一個警告。如果兩個邊界 BPM 都缺，目前的計算會給出零差值加一個警告，而不是把兩個歌曲層級的值都撈回來。歌曲層級的配對就用歌曲層級的速度。所以資料缺漏會讓一組配對看起來比實際容易；那個警告值得讀。

## 和聲只是粗略參考

[和聲輔助](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/ops/admin-cli/src/stream_of_worship/admin/songset_constructor/rules/harmony.py)會把小調對到它的關係大調，並量測在五度圈上的最短距離。它只在兩個半音以內找移調，距離相同時偏好位移較小的那個。

這是個方便的和諧度指標，但限制也很明顯。關係大調和小調不是可以互換的音樂體驗，調性相容也不保證編曲相容。

建議程式會在 `pivot`、`relative`、`direct`、`transposition`、`vamp`、`direct_modulation` 之間挑一個。近的調性給兩拍的間隔、不做交叉淡化。距離比較遠的情況，依分支給四秒、六秒或八秒的重疊。`transposition` 分支比 `vamp` 分支先檢查。

這些名稱描述的是建議，不是實際做法。渲染器不會合成一段 vamp，也不會搭出樞紐和弦的過門。調性信心低時這裡會加一個警告；建構器那邊另一個驗證器，會在適用的進場信心值是已知且低於 0.6 時，拒絕非零的移調。信心值缺漏不會觸發那個拒絕。

## 從拍子換算成毫秒

[渲染 worker 的音訊引擎](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/render-worker/src/sow_render_worker/audio_engine.py)用進場項目的錄音速度，把間隔從拍換算成毫秒。它不吃建構器算出來的邊界 BPM。速度拿不到時，就退回「每一拍一秒」。

開啟交叉淡化又有設定長度時，間隔就變成零。進場的起點是前一段的結尾加間隔減去重疊，並夾在零以上。fade 濾波器修飾重疊段，delay 濾波器擺放音軌，再由 FFmpeg 混音。選用的響度正規化會把最後的混音對到 −14 LUFS。

這樣足以產生一個連續的檔案。它不會檢查人聲旋律有沒有撞在一起，也不會在副歌裡挑一個更好的位置來剪。

## 存了卻不會改變混音的設定

`key_shift_semitones` 和 `tempo_ratio` 會被載入、也會被存下來，但我看的那個渲染 worker 兩個都沒套用。它的音訊路徑裡沒有變調或時間伸縮的濾波器。[音訊引擎測試](https://github.com/mhuang74/stream_of_worship/blob/01dae04a94f01747e954f5fd079d20fe230987e7/delivery/render-worker/tests/test_audio_engine.py)對已實作的時間與濾波行為很有用；它們不是聽感評估。

這讓評分和交付之間留了一個尷尬的缺口。一個建議可以靠著移調滿足和聲規則，但渲染出來的檔案從來沒收到那個移調。在把移調講成真的能用的音訊控制之前，我會先補上這塊。

目前實務上能做的檢查，就是去聽渲染出來的轉場。距離好看或技術標籤漂亮，只是值得試一組配對的理由，不是它聽起來好不好的結論。
