export const LOCALES = ["en", "zh-tw"] as const;

export type Locale = (typeof LOCALES)[number];

export const HTML_LANG: Record<Locale, string> = {
  en: "en",
  "zh-tw": "zh-Hant-TW",
};

export const OG_LOCALE: Record<Locale, string> = {
  en: "en_US",
  "zh-tw": "zh_TW",
};

export const getLocaleFromPath = (pathname: string): Locale =>
  pathname === "/zh-tw" || pathname.startsWith("/zh-tw/") ? "zh-tw" : "en";

export const stripLocale = (pathname: string): string => {
  if (pathname === "/zh-tw") return "/";
  if (pathname.startsWith("/zh-tw/")) return pathname.slice("/zh-tw".length);
  return pathname;
};

export const localizePath = (path: string, locale: Locale): string =>
  locale === "en" ? path : path === "/" ? "/zh-tw" : `/zh-tw${path}`;

export const switchLocalePath = (pathname: string): string =>
  localizePath(
    stripLocale(pathname),
    getLocaleFromPath(pathname) === "en" ? "zh-tw" : "en"
  );
