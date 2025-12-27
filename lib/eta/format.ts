import type { UiLanguage } from "@/lib/eta/types";

export function formatRelativeMinutes(targetIso: string, now = new Date()) {
  const target = new Date(targetIso);
  const diffMs = target.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);
  return diffMin;
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
