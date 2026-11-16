---
title: Infinite Worship：分析 API 消失後，音樂還是能一直播下去
author: Michael Huang
pubDatetime: 2026-10-20T00:00:00Z
featured: false
draft: false
tags:
  - building
  - infinite-worship
  - music
description: 原始分析 API 消失後，為敬拜音樂重做 Infinite Jukebox
translationOf: infinite-worship
sourceUpdated: 2026-10-20T00:00:00Z
---

我想拿中文敬拜音樂來試 [Infinite Jukebox](https://eternalboxmirror.xyz/jukebox_index.html) 這個點子。原始專案可以把一首歌變成無止盡的 remix，做法是在相似的節拍之間跳來跳去。但它依賴的公開音訊分析 API 已經不提供了，所以那部分我得自己重做。

成果是 [Infinite Worship](https://infinite-worship.vercel.app)，一個靠著在聽起來相似的節拍之間跳躍、讓一首歌一直播下去的網頁應用程式。歌曲可以上傳，也可以從目錄匯入。分析只做一次，之後播放器可以繼續在歌裡挑不同的路徑。[原始碼](https://github.com/mhuang74/infinite-worship)也開放了。

<!-- more -->

## 播放怎麼運作

基本想法是把一首歌當成一張由節拍構成的圖。當播放器走到某個節拍，而它還有其他相似的節拍時，就可能跳到其中一個，而不是照原本的方式繼續。

播放這邊沒有太複雜的東西。最後我定下幾條規則：

- 節拍是原子單位。一次跳躍取代下一個節拍。音訊絕不拉伸。
- 對準你原本要播的那個節拍。候選必須符合下一個節拍的 cluster、segment 位置和 measure 位置。
- 分析一次，永遠可跳。結果以內容雜湊快取。
- 隨機化路徑，但把隨機性框住。每個節拍有 15% 的機率觸發跳躍，且距上次跳躍至少 8 個節拍，候選不得比 16 個節拍更近。
- 處理開頭和結尾。最後 16 個節拍淡出，同時前 16 個節拍在前 8 個節拍內淡入。
- 如果有歌詞，只在歌詞行邊界 500 ms 內跳躍。

跳躍是硬切，不是交叉淡化。只要取代的那個節拍聽起來跟原本該播的節拍夠接近，就成立。播放器一次排一個節拍，帶一點前瞻緩衝。如果瀏覽器跟不上，它會往前跳，而不是試著把音訊排到過去。

## 補上消失的分析 API

原本的 [Infinite Jukebox](https://eternalboxmirror.xyz/jukebox_index.html) 用 Spotify 的 [Audio Analysis API](https://developer.spotify.com/documentation/web-api/reference/get-audio-analysis)，它會回傳一首歌的節拍、段落、分段、音色等分析。新的應用程式[已經不能再用](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api?trk=public_post_comment-text&utm_source=chatgpt.com)那些音訊分析端點。少了那些資料，難的部分就是判斷哪些節拍連起來是安全的。

參考 [Brian McFee](https://speakerdeck.com/bmcfee/analyzing-song-structure-with-spectral-clustering) 的 Spectral Clustering 做法，我自己用 [librosa](https://librosa.org/)、[madmom](https://github.com/CPJKU/madmom) 和 [scikit-learn](https://scikit-learn.org/) 來跑分析。它們跑在容器化的 worker 裡，因為分析一首歌可能要幾分鐘。結果以音訊雜湊快取，所以同一個音訊檔就算被不同人上傳，也只需要分析一次。

## 把音訊變成跳躍圖

大致上的分析流程：

1. 載入音訊，裁掉靜音。
2. 算 constant-Q transform。
3. 偵測節拍和重拍（downbeat）。
4. 把音訊特徵組成每個節拍一個向量。
5. 建立相似度圖並平滑。
6. 結合重複性和序列資訊。
7. 對圖做分群，產生跳躍候選。

叢集數量調了一陣子。只用 silhouette score 產生的分群在數學上很乾淨，但有時會讓播放器幾乎無處可跳。叢集太少則相反，會放進太多可疑的跳躍。所以適應函數也會獎勵「有足夠好用跳躍選項」的結果。

## 目錄教我的事

拿真的中文敬拜歌曲來測試，馬上就暴露一個明顯問題。跳躍可能離開句子，或落在句子中間。音訊的轉場聽起來也許沒問題，但拼出來的歌詞完全不通。背景一直播著的舞曲和搖滾歌，你不會注意到這件事；但用同樣的技術去延長歌詞意義吃重的敬拜歌曲，就會打斷敬拜的體驗。

我加了一個篩選，讓跳躍盡量靠近歌詞行邊界。有幫助，但比我期望的少。斷掉的句子變少了，可是歌詞邊界乾淨，並不自動代表跳躍能維持整首的流動，即使是節奏較快的敬拜歌也一樣。

編曲稀疏、速度較慢的歌，可互換的節拍通常比較少。快一點、簡單一點、重複多一點的歌，效果通常比較好。我覺得挑歌可能跟繼續調演算法一樣重要。有些歌就是不適合無限播放。

## 還會壞的地方

限制還不少。

分析假設每小節四拍，所以其他拍號的歌，跳躍候選會比較弱。沒有調性或速度的正規化。重複很少的歌，可能根本產生不出足夠的候選。

工程面上，分析要幾分鐘，不是幾毫秒。音訊相依套件也偏脆弱，瀏覽器的排程精確度有極限。內容雜湊避免了重複的工作，但它不是存取控制。改了 DSP 參數，也還不會讓舊的快取結果失效。

下一步大概是分析前先做歌曲適合度檢查。與其為一首本來就不會好聽的歌一直調跳躍機率，警告「這首歌不太適合」似乎更有用。

## 試試看

按 Zen Mode Full Screen 按鈕，看那個很酷的視覺化！

不知道挑哪首歌？直接點「Let if flow」連結。

[Infinite Worship 網頁應用程式](https://infinite-worship.michaelhuang.xyz/)
