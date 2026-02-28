"use client";

import * as React from "react";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  React.useEffect(() => {
    console.error("[App] Route error", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-start justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        The page hit an unexpected error. Try again, or refresh the page if the issue
        persists.
      </p>
      <button
        type="button"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        onClick={reset}
      >
        Try again
      </button>
    </div>
  );
}
