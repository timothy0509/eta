"use client";

import { motion } from "framer-motion";
import { ArrowRight, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { RouteRecord } from "@/lib/hkbus/types";

interface RouteCardProps {
  route: RouteRecord;
  index: number;
}

const OPERATOR_COLORS: Record<string, string> = {
  kmb: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  ctb: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  nlb: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  gmb: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  lrtfeeder: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
};

const OPERATOR_LABELS: Record<string, string> = {
  kmb: "KMB",
  ctb: "Citybus",
  nlb: "NLB",
  gmb: "GMB",
  lrtfeeder: "LRT",
};

export function RouteCard({ route, index }: RouteCardProps) {
  const encodedRouteId = encodeURIComponent(route.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
    >
      <a
        href={`/route/${encodedRouteId}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-xl"
      >
        <Card className="group cursor-pointer border-border bg-card transition-all duration-150 hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg font-bold text-foreground font-heading">
                    {route.route}
                  </span>
                  <div className="flex gap-1">
                    {route.companies.map((company) => (
                      <Badge
                        key={company}
                        variant="secondary"
                        className={`text-xs font-medium ${OPERATOR_COLORS[company] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {OPERATOR_LABELS[company] ?? company}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{route.origin.en}</span>
                  <ArrowRight className="h-3 w-3 shrink-0" />
                  <span className="truncate">{route.destination.en}</span>
                </div>
                {route.origin.zh !== route.origin.en && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/70 mt-1">
                    <span className="truncate">{route.origin.zh}</span>
                    <ArrowRight className="h-3 w-3 shrink-0" />
                    <span className="truncate">{route.destination.zh}</span>
                  </div>
                )}
              </div>
              <div className="shrink-0 text-muted-foreground group-hover:text-primary transition-colors duration-150">
                <ArrowRight className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </a>
    </motion.div>
  );
}
