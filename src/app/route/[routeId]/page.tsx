"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Bus, MapPin } from "lucide-react";
import { Header } from "@/components/header";
import { StopList } from "@/components/stop-list";
import { Skeleton } from "@/components/ui/skeleton";
import type { RouteStopRecord } from "@/lib/hkbus/types";

const OPERATOR_LABELS: Record<string, string> = {
  kmb: "KMB",
  ctb: "Citybus",
  nlb: "NLB",
  gmb: "GMB",
  lrtfeeder: "LRT",
};

export default function RoutePage() {
  const params = useParams();
  const routeId = decodeURIComponent(params.routeId as string);

  const [operator, setOperator] = useState<string | null>(null);
  const [operators, setOperators] = useState<string[]>([]);
  const [stops, setStops] = useState<RouteStopRecord[] | null>(null);
  const [routeInfo, setRouteInfo] = useState<{
    route: string;
    origin: { en: string; zh: string };
    destination: { en: string; zh: string };
  } | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(true);
  const [isLoadingStops, setIsLoadingStops] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadRouteInfo() {
      setIsLoadingRoute(true);
      try {
        const res = await fetch(
          `/api/routes?query=${encodeURIComponent(routeId)}&limit=1`
        );
        const data = await res.json();
        if (!cancelled && data.ok && data.data.routes.length > 0) {
          const route = data.data.routes[0];
          setRouteInfo({
            route: route.route,
            origin: route.origin,
            destination: route.destination,
          });
          setOperators(route.companies);
          setOperator((prev) => prev ?? route.companies[0]);
        }
      } catch {
        if (!cancelled) {
          setOperators([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingRoute(false);
        }
      }
    }

    loadRouteInfo();

    return () => {
      cancelled = true;
    };
  }, [routeId]);

  useEffect(() => {
    if (!operator) return;

    let cancelled = false;

    async function loadStops() {
      setIsLoadingStops(true);
      try {
        const res = await fetch(
          `/api/routes/${encodeURIComponent(routeId)}/stops?operator=${operator}`
        );
        const data = await res.json();
        if (!cancelled && data.ok) {
          setStops(data.data.stops);
        }
      } catch {
        if (!cancelled) {
          setStops([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingStops(false);
        }
      }
    }

    loadStops();

    return () => {
      cancelled = true;
    };
  }, [routeId, operator]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-6">
        <div className="space-y-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-lg"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to search
          </Link>

          {isLoadingRoute && !routeInfo ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-5 w-64" />
            </div>
          ) : routeInfo ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                  <Bus className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground font-heading">
                    Route {routeInfo.route}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>{routeInfo.origin.en}</span>
                <span className="text-muted-foreground/50">→</span>
                <span>{routeInfo.destination.en}</span>
              </div>

              {operators.length > 1 && (
                <div className="flex gap-2 pt-1">
                  {operators.map((op) => (
                    <button
                      key={op}
                      onClick={() => setOperator(op)}
                      className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                        operator === op
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {OPERATOR_LABELS[op] ?? op}
                    </button>
                  ))}
                </div>
              )}

              <div className="pt-2">
                {isLoadingStops ? (
                  <div className="space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-xl" />
                    ))}
                  </div>
                ) : stops && stops.length > 0 ? (
                  <StopList
                    stops={stops}
                    routeId={routeId}
                    operator={operator ?? ""}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="rounded-full bg-muted p-4 mb-4">
                      <Bus className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-1">
                      No stops found
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Try a different operator
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Bus className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                Route not found
              </h3>
              <p className="text-sm text-muted-foreground">
                The route you are looking for does not exist
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
