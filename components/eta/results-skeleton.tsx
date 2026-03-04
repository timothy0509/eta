import * as React from "react";

import { Card, CardContent } from "@/components/ui/card";

export function ResultsSkeleton() {
  return (
    <Card className="rounded-3xl border bg-card/60 p-0 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl bg-muted/50"
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
