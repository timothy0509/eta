type StatusBadgeProps = {
  label: string;
  tone?: "info" | "warning";
};

export default function StatusBadge({ label, tone = "info" }: StatusBadgeProps) {
  const styles =
    tone === "warning"
      ? "bg-[var(--accent-warm)] text-white"
      : "bg-[var(--accent)] text-white";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles}`}>
      {label}
    </span>
  );
}
