import type { UiLanguage } from "@/lib/eta/types";

export function formatRelativeMinutes(targetIso: string, now = new Date()) {
  const target = new Date(targetIso);
  const diffMs = target.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);
  return diffMin;
}

export function getUiLocale(lang: UiLanguage) {
  if (lang === "en") return "en-HK";
  if (lang === "sc") return "zh-Hans-HK";
  return "zh-Hant-HK";
}

export function formatUiTime(date: Date, lang: UiLanguage) {
  return new Intl.DateTimeFormat(getUiLocale(lang), {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatUiLanguageLabel(lang: UiLanguage) {
  switch (lang) {
    case "en":
      return "EN";
    case "tc":
      return "繁";
    case "sc":
      return "简";
  }
}
