"use client";

import { useState, useCallback, useEffect } from "react";
import { Header } from "@/components/header";
import { SearchInput } from "@/components/search-input";
import { OperatorTabs } from "@/components/operator-tabs";
import { RouteList } from "@/components/route-list";
import type { BusCompany, RouteRecord } from "@/lib/hkbus/types";

export default function Home() {
  const [query, setQuery] = useState("");
  const [operator, setOperator] = useState<BusCompany | null>(null);
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const searchRoutes = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      if (operator) params.set("operator", operator);
      params.set("limit", "20");

      const res = await fetch(`/api/routes?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setRoutes(data.data.routes);
      }
    } catch {
      setRoutes([]);
    } finally {
      setIsLoading(false);
    }
  }, [query, operator]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (query || operator) {
        searchRoutes();
      } else {
        setRoutes([]);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query, operator, searchRoutes]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-6">
        <div className="space-y-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground font-heading">
              Bus Arrivals
            </h1>
            <p className="text-sm text-muted-foreground">
              Real-time ETA for Hong Kong bus routes
            </p>
          </div>

          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search route number or destination..."
          />

          <OperatorTabs selected={operator} onSelect={setOperator} />

          <div className="pt-2">
            <RouteList
              routes={routes}
              isLoading={isLoading}
              hasSearch={!!query || !!operator}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
