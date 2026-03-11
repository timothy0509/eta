"use client";

import * as React from "react";
import { useAppStore, type CachedLocation } from "@/lib/store";

const LOCATION_CACHE_MS = 5 * 60 * 1000;

export type GeolocationState = {
  location: CachedLocation | null;
  loading: boolean;
  error: string | null;
};

export type UseGeolocationReturn = GeolocationState & {
  requestLocation: () => Promise<CachedLocation | null>;
};

export function useGeolocation(): UseGeolocationReturn {
  const lastKnownLocation = useAppStore((s) => s.lastKnownLocation);
  const setLastKnownLocation = useAppStore((s) => s.setLastKnownLocation);

  const [state, setState] = React.useState<GeolocationState>({
    location: lastKnownLocation,
    loading: false,
    error: null,
  });

  const isLocationFresh = React.useCallback((loc: CachedLocation | null): boolean => {
    if (!loc) return false;
    return Date.now() - loc.timestamp < LOCATION_CACHE_MS;
  }, []);

  const requestLocation = React.useCallback(async (): Promise<CachedLocation | null> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      const error = "Geolocation not supported";
      setState((prev) => ({ ...prev, error, loading: false }));
      return null;
    }

    if (isLocationFresh(lastKnownLocation)) {
      setState((prev) => ({ ...prev, location: lastKnownLocation, loading: false }));
      return lastKnownLocation;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc: CachedLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: Date.now(),
          };
          setLastKnownLocation(loc);
          setState({ location: loc, loading: false, error: null });
          resolve(loc);
        },
        (err) => {
          let error: string;
          switch (err.code) {
            case err.PERMISSION_DENIED:
              error = "Location permission denied";
              break;
            case err.POSITION_UNAVAILABLE:
              error = "Location unavailable";
              break;
            case err.TIMEOUT:
              error = "Location request timed out";
              break;
            default:
              error = "Failed to get location";
          }
          setState((prev) => ({ ...prev, error, loading: false }));
          resolve(null);
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: LOCATION_CACHE_MS,
        }
      );
    });
  }, [lastKnownLocation, setLastKnownLocation, isLocationFresh]);

  return {
    ...state,
    requestLocation,
  };
}
