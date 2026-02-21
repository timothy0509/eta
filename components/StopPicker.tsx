"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type StopPickerOption = {
  id: string;
  label: string;
  sublabel?: string;
  seq: number;
};

type StopPickerProps = {
  label: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  options: StopPickerOption[];
  value: StopPickerOption | null;
  onChange: (option: StopPickerOption) => void;
  disabled?: boolean;
};

export default function StopPicker({
  label,
  placeholder = "Select a stop",
  searchPlaceholder = "Search stops",
  emptyLabel = "No stops found.",
  options,
  value,
  onChange,
  disabled,
}: StopPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return options;
    return options.filter((option) => {
      const labelMatch = option.label.toLowerCase().includes(trimmed);
      const subMatch = option.sublabel?.toLowerCase().includes(trimmed);
      return labelMatch || subMatch;
    });
  }, [options, query]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <label className="text-sm font-medium text-[var(--foreground)]">
        {label}
      </label>
      <button
        type="button"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={`mt-2 flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
          disabled
            ? "cursor-not-allowed border-[var(--line)] bg-white/50 text-[var(--muted)]"
            : "border-[var(--line)] bg-white hover:border-[var(--accent)]"
        }`}
        aria-expanded={open}
      >
        <span className={value ? "text-[var(--foreground)]" : "text-[var(--muted)]"}>
          {value ? value.label : placeholder}
        </span>
        <span className="text-[var(--muted)]">▾</span>
      </button>

      {open && !disabled && (
        <div className="absolute left-0 right-0 z-20 mt-2 rounded-2xl border border-[var(--line)] bg-white p-3 shadow-lg">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
          />
          <div className="mt-3 max-h-64 space-y-2 overflow-auto pr-1">
            {filtered.length === 0 && (
              <p className="text-sm text-[var(--muted)]">{emptyLabel}</p>
            )}
            {filtered.map((option) => (
              <button
                type="button"
                key={option.id}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className="flex w-full flex-col rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-left text-sm transition hover:border-[var(--accent)]"
              >
                <span className="font-medium text-[var(--foreground)]">
                  {option.label}
                </span>
                {option.sublabel && (
                  <span className="text-xs text-[var(--muted)]">
                    {option.sublabel}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
