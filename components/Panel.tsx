import type { PropsWithChildren } from "react";

type PanelProps = PropsWithChildren<{
  className?: string;
}>;

export default function Panel({ className, children }: PanelProps) {
  return (
    <section
      className={`rounded-3xl border border-[var(--line)] bg-[var(--surface-1)] p-6 shadow-[var(--shadow-card)] ${
        className ?? ""
      }`}
    >
      {children}
    </section>
  );
}
