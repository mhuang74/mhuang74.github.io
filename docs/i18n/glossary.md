# zh-TW translation guide

The Chinese edition lives under `/zh-tw/…` with the same ASCII slugs as English. English is canonical; Chinese may lag.

## Voice

Colloquial professional, first person 我. Sound like a Taiwanese-American engineer explaining work to a colleague. Natural Chinese-English code-switching is expected for tooling and dev verbs — `ship 出去`, `deploy 完`, `debug`, `build`, `coding agent`, `prompt`, `PR`, `merge`. Do not translate project names, product names, stack names, or API names.

## Vocabulary

Taiwan vocabulary only. Never use mainland forms: 軟體 (not 软件), 專案 (not 项目), 資料 (not 数据), 程式碼 (not 代码), 網路 (not 网络), 使用者 (not 用户), 預設 (not 默认), 支援 (not 支持), 最佳化 (not 优化), 伺服器 (not 服务器), 資料庫 (not 数据库), 部署, 快取 (not 缓存), 佇列 (not 队列), 影片 (not 视频), 音訊 (not 音频), 品質 (not 质量), 資訊 (not 信息), 透過 (not 通过), 設定 (not 设置).

| English | zh-TW |
|---|---|
| case study | 案例研究 |
| product engineer | 產品工程師 |
| player-coach | 球員兼教練 |
| feature | 功能 |
| user | 使用者 |
| customer | 客戶 |
| team | 團隊 |
| product manager | 產品經理 |
| constraint | 限制 |
| tradeoff | 取捨 |
| architecture | 架構 |
| pipeline | 管線 |
| queue | 佇列 |
| cache | 快取 |
| serverless | 無伺服器 |
| deployment | 部署 |
| release | 發布 |
| ship (verb) | 交付／上線（口語可用 ship） |
| model | 模型 |
| agent | 代理程式（首次出現可寫「代理程式（agent）」） |
| prompt | 提示詞 |
| embedding | 嵌入向量 |
| inference | 推論 |
| evaluation | 評估 |
| benchmark | 基準測試 |
| lyrics | 歌詞 |
| worship | 敬拜 |
| small group | 小組 |
| Sunday service | 主日聚會 |
| audio | 音訊 |
| video | 影片 |
| render | 渲染 |
| crossfade | 交叉淡化 |
| transition | 轉場 |
| tempo | 速度 |
| key | 調性 |
| beat | 節拍 |
| chorus | 副歌 |
| verse | 主歌 |
| section | 段落 |
| catalog | 目錄 |
| songset | 歌曲組 |

Punctuation: full-width `，。、；：！？`, quotes `「」`, book/article titles `《》`, parentheses `（）`. No space between Chinese characters and Latin words unless the Latin token is a standalone identifier; code spans and file paths stay half-width. Dates `2026 年 10 月 20 日`; ranges `2012–2022`.

Do not translate: fenced code, commands, output, identifiers, URLs, file paths, chart data values, song titles, keys, BPM, score numbers, stack names, project names.

Do not add or remove claims. Every number, metric, and dated fact in Chinese must match the English source exactly.

## Tag labels

Tag slugs stay English (`slugifyStr(EnglishTag)`); labels come from `src/i18n/tagLabels.ts`.

| slug | label |
|---|---|
| android | Android |
| audio | 音訊 |
| aws | AWS |
| building | 開發紀實 |
| chart | 圖表 |
| data-engineering | 資料工程 |
| design | 設計 |
| google-ads | Google Ads |
| infinite-worship | Infinite Worship |
| infrastructure | 基礎設施 |
| kotlin | Kotlin |
| lyrics | 歌詞 |
| machine-learning | 機器學習 |
| macos | macOS |
| music | 音樂 |
| nextjs | Next.js |
| offline | 離線 |
| open-data | 開放資料 |
| python | Python |
| retrospective | 回顧 |
| rust | Rust |
| stream-of-worship | Stream of Worship |
| table | 表格 |
| web | 網站開發 |
| worship | 敬拜 |
| zola | Zola |

## Review workflow

The owner reviews published Chinese pages and edits the files in `src/data/blog/zh-tw/`, `src/data/work/zh-tw/`, `src/pages/zh-tw/`, and `src/i18n/` directly. There is no translation-status page.

Each translation carries `translationOf` (the English entry id) and `sourceUpdated` (the English `modDatetime ?? pubDatetime` at translation time). When the English post is newer than `sourceUpdated`, the Chinese page renders an outdated-translation notice with a link to the English original.

Chinese listings are built from the English collection order. Posts that have no Chinese file yet appear with an 「英文版」badge and link to the English page.
