/**
 * Nearby stops finder using Haversine distance formula
 */

import type { KmbStopSearchItem, UiLanguage } from "@/lib/eta/types";
import {
  buildStopComputed,
  groupStopsByName,
  type StopGroup,
} from "@/lib/eta/stop-grouping";

export type NearbyStopsOptions = {
  maxDistanceMeters: number;
  maxGroups: number;
};

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculate distance between two coordinates using Haversine formula.
 * Returns distance in meters.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Find nearby stops grouped by name, sorted by distance.
 * Returns up to maxGroups groups within maxDistanceMeters.
 */
export function findNearbyStopGroups(
  stops: KmbStopSearchItem[],
  userLocation: { lat: number; lng: number },
  lang: UiLanguage,
  options: NearbyStopsOptions
): StopGroup[] {
  const { maxDistanceMeters, maxGroups } = options;

  const stopsWithDistance = stops
    .map((stop) => ({
      stop,
      distance: haversineDistance(
        userLocation.lat,
        userLocation.lng,
        stop.lat,
        stop.lng
      ),
    }))
    .filter((item) => item.distance <= maxDistanceMeters)
    .sort((a, b) => a.distance - b.distance);

  const computed = stopsWithDistance.map((item) => buildStopComputed(item.stop, lang));

  const grouped = groupStopsByName(computed);

  return grouped.slice(0, maxGroups);
}

/**
 * Find nearby stops and return flat list of stop IDs.
 * Useful for passing directly to ETA fetcher.
 */
export function findNearbyStopIds(
  stops: KmbStopSearchItem[],
  userLocation: { lat: number; lng: number },
  lang: UiLanguage,
  options: NearbyStopsOptions
): string[] {
  const groups = findNearbyStopGroups(stops, userLocation, lang, options);
  return groups.flatMap((g) => g.stops.map((s) => s.stopId));
}
