"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MapPin, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { RouteStopRecord, EtaRecord } from "@/lib/hkbus/types";

interface StopListProps {
  stops: RouteStopRecord[];
  routeId: string;
  operator: string;
}

function EtaBadge({ eta }: { eta: EtaRecord }) {
  const minutes = eta.minutes;

  if (minutes === null) {
    return (
      <Badge variant="outline" className="text-xs">
        {eta.remark.en || "--"}
      </Badge>
    );
  }

  if (minutes <= 1) {
    return (
      <Badge className="bg-transit-success text-white text-xs animate-pulse-live">
        Arriving
      </Badge>
    );
  }

  if (minutes <= 5) {
    return (
      <Badge className="bg-transit-warning text-white text-xs">
        {minutes} min
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="text-xs">
      {minutes} min
    </Badge>
  );
}

function EtaDisplay({
  routeId,
  operator,
  seq,
}: {
  routeId: string;
  operator: string;
  seq: number;
}) {
  const [etas, setEtas] = useState<EtaRecord[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadEta() {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/eta?routeId=${encodeURIComponent(routeId)}&operator=${operator}&seq=${seq}&lang=en`
        );
        const data = await res.json();
        if (!cancelled && data.ok) {
          setEtas(data.data.etas);
        }
      } catch {
        if (!cancelled) {
          setEtas([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadEta();

    const interval = setInterval(loadEta, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [routeId, operator, seq]);

  if (isLoading && etas === null) {
    return <Skeleton className="h-5 w-16" />;
  }

  if (!etas || etas.length === 0) {
    return (
      <Badge variant="outline" className="text-xs text-muted-foreground">
        No data
      </Badge>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {etas.slice(0, 3).map((eta, i) => (
        <EtaBadge key={i} eta={eta} />
      ))}
    </div>
  );
}

export function StopList({ stops, routeId, operator }: StopListProps) {
  return (
    <div className="space-y-2">
      {stops.map((stop, index) => (
        <motion.div
          key={stop.stopId}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, delay: index * 0.02 }}
        >
          <Card className="border-border bg-card transition-all duration-150 hover:border-primary/20 hover:shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center gap-1">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {stop.sequence + 1}
                  </div>
                  {index < stops.length - 1 && (
                    <div className="h-full w-px bg-border" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground truncate">
                      {stop.name.en}
                    </span>
                  </div>
                  {stop.name.zh !== stop.name.en && (
                    <p className="text-xs text-muted-foreground/70 truncate ml-5">
                      {stop.name.zh}
                    </p>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <EtaDisplay
                    routeId={routeId}
                    operator={operator}
                    seq={stop.sequence}
                  />
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
