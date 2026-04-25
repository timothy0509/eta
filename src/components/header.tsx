"use client";

import Link from "next/link";
import { Bus } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
        <Link
          href="/"
          className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-lg"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Bus className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-foreground font-heading">
            HK Bus ETA
          </span>
        </Link>
      </div>
    </header>
  );
}
