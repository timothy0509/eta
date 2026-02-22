"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

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
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();

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
    if (!open) {
      setQuery("");
      setActiveIndex(0);
      return;
    }
    const timer = setTimeout(() => listRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
  }, [query, open]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (filtered.length === 0) return;
      setOpen(true);
      setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen((prev) => !prev);
    }
  }

  function handleListKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (filtered.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[activeIndex];
      if (option) {
        onChange(option);
        setOpen(false);
      }
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label className="text-sm font-medium text-[var(--foreground)]">
        {label}
      </label>
        <button
          type="button"
          onClick={() => !disabled && setOpen((prev) => !prev)}
          onKeyDown={handleKeyDown}
          className={`mt-2 flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
            disabled
              ? "cursor-not-allowed border-[var(--line)] bg-white/50 text-[var(--muted)]"
              : "border-[var(--line)] bg-white hover:border-[var(--accent)]"
          }`}
          aria-expanded={open}
          aria-controls={listId}
          aria-haspopup="listbox"
        >
        <span className={value ? "text-[var(--foreground)]" : "text-[var(--muted)]"}>
          {value ? value.label : placeholder}
        </span>
        <span className="text-[var(--muted)]">▾</span>
      </button>

      {open && !disabled && (
        <div
          className="absolute left-0 right-0 z-20 mt-2 rounded-2xl border border-[var(--line)] bg-white p-3 shadow-lg"
          role="listbox"
          id={listId}
          tabIndex={0}
          onKeyDown={handleListKeyDown}
          ref={listRef}
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
            onKeyDown={(event) => {
              if (filtered.length === 0) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((prev) => Math.max(prev - 1, 0));
              }
              if (event.key === "Enter") {
                event.preventDefault();
                const option = filtered[activeIndex];
                if (option) {
                  onChange(option);
                  setOpen(false);
                }
              }
            }}
          />
          <div className="mt-3 max-h-64 space-y-2 overflow-auto pr-1">
            {filtered.length === 0 && (
              <p className="text-sm text-[var(--muted)]">{emptyLabel}</p>
            )}
            {filtered.map((option, index) => (
              <button
                type="button"
                key={option.id}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className={`flex w-full flex-col rounded-xl border px-3 py-2 text-left text-sm transition ${
                  index === activeIndex
                    ? "border-[var(--accent)] bg-[var(--card)]"
                    : "border-[var(--line)] bg-[var(--card)] hover:border-[var(--accent)]"
                }`}
                role="option"
                aria-selected={index === activeIndex}
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
