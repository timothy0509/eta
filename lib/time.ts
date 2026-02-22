export type TimeMode = "countdown" | "exact";

export type TimeLabels = {
  due: string;
  minutes: string;
  hours: string;
};

export function parseTime(value: string): Date | null {
  if (!value || value === "-") return null;
  if (value.includes("T")) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const match = value.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/);
  if (match) {
    const parsed = new Date(`${match[1]}T${match[2]}+08:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatEtaTime(
  value: string,
  mode: TimeMode,
  labels: TimeLabels,
  locale: string,
) {
  const parsed = parseTime(value);
  if (!parsed) return value || "-";

  if (mode === "exact") {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(parsed);
  }

  const diffMs = parsed.getTime() - Date.now();
  if (diffMs <= 0) return labels.due;
  const totalMinutes = Math.max(1, Math.round(diffMs / 60000));
  if (totalMinutes < 60) return `${totalMinutes} ${labels.minutes}`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes
    ? `${hours}${labels.hours} ${minutes} ${labels.minutes}`
    : `${hours}${labels.hours}`;
}
