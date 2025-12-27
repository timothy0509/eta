"use client";

import { Heart, History, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore, type FavoritesItem } from "@/lib/store";

type Props = {
  onSelect: (item: FavoritesItem) => void;
};

export function FavoritesAndRecents({ onSelect }: Props) {
  const favorites = useAppStore((s) => s.favorites);
  const recents = useAppStore((s) => s.recents);
  const removeFavorite = useAppStore((s) => s.removeFavorite);
  const clearRecents = useAppStore((s) => s.clearRecents);

  return (
    <Card className="rounded-3xl">
      <Tabs defaultValue="favorites" className="gap-0">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Saved</CardTitle>
          <TabsList>
            <TabsTrigger value="favorites" className="gap-2">
              <Heart className="h-4 w-4" /> Favorites
            </TabsTrigger>
            <TabsTrigger value="recent" className="gap-2">
              <History className="h-4 w-4" /> Recent
            </TabsTrigger>
          </TabsList>
        </CardHeader>

        <CardContent className="p-0">
          <TabsContent value="favorites" className="mt-0 p-6 pt-0">
            <div className="space-y-2">
              {favorites.length === 0 ? (
                <div className="text-sm text-muted-foreground">No favorites yet.</div>
              ) : (
                favorites.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between gap-2 rounded-2xl border bg-background/40 px-3 py-2"
                  >
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => onSelect(f)}
                    >
                      <div className="truncate text-sm font-medium">{f.title}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {f.mode.toUpperCase()}
                      </div>
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded-xl"
                      onClick={() => removeFavorite(f.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="recent" className="mt-0 p-6 pt-0">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  Tip: results can auto-refresh while you wait.
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearRecents}
                  className="rounded-xl"
                  disabled={!recents.length}
                >
                  Clear
                </Button>
              </div>

              {recents.length === 0 ? (
                <div className="text-sm text-muted-foreground">No recent searches.</div>
              ) : (
                recents.map((r) => (
                  <button
                    key={`${r.id}-${r.at}`}
                    className="w-full rounded-2xl border bg-background/40 px-3 py-2 text-left hover:bg-background/60"
                    onClick={() => onSelect(r)}
                  >
                    <div className="truncate text-sm font-medium">{r.title}</div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{r.mode.toUpperCase()}</span>
                      <span>{new Date(r.at).toLocaleString()}</span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <Separator className="my-2" />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
