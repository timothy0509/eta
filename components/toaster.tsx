"use client";

import { Toaster as Sonner } from "@/components/ui/sonner";
import { useMediaQuery } from "@/lib/hooks/use-media-query";

export function Toaster() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return <Sonner richColors position={isDesktop ? "top-right" : "bottom-center"} />;
}
