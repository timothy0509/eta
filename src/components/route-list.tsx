"use client";

import { motion } from "framer-motion";
import { Search, Bus } from "lucide-react";
import { RouteCard } from "@/components/route-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { RouteRecord } from "@/lib/hkbus/types";

interface RouteListProps {
  routes: RouteRecord[];
  isLoading: boolean;
  hasSearch: boolean;
}

export function RouteList({ routes, isLoading, hasSearch }: RouteListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (routes.length === 0) {
    if (hasSearch) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="rounded-full bg-muted p-4 mb-4">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">
            No routes found
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Try a different search term or operator filter
          </p>
        </motion.div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-16 text-center"
      >
        <div className="rounded-full bg-muted p-4 mb-4">
          <Bus className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">
          Search for a bus route
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Enter a route number or destination to see real-time arrival information
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      {routes.map((route, index) => (
        <RouteCard key={route.id} route={route} index={index} />
      ))}
    </div>
  );
}
