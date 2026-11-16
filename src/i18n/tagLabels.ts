import type { Locale } from "./locale";

/** Display labels keyed by `slugifyStr(tag)`; English stays the source tag. */
const zhTwLabels: Record<string, string> = {
  android: "Android",
  audio: "音訊",
  aws: "AWS",
  building: "開發紀實",
  chart: "圖表",
  "data-engineering": "資料工程",
  design: "設計",
  "google-ads": "Google Ads",
  "infinite-worship": "Infinite Worship",
  infrastructure: "基礎設施",
  kotlin: "Kotlin",
  lyrics: "歌詞",
  "machine-learning": "機器學習",
  macos: "macOS",
  music: "音樂",
  nextjs: "Next.js",
  offline: "離線",
  "open-data": "開放資料",
  python: "Python",
  retrospective: "回顧",
  rust: "Rust",
  "stream-of-worship": "Stream of Worship",
  table: "表格",
  web: "網站開發",
  worship: "敬拜",
  zola: "Zola",
};

export const getTagLabel = (locale: Locale, tag: string): string =>
  locale === "zh-tw" ? (zhTwLabels[tag] ?? tag) : tag;
