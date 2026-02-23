import type { KmbStopSearchItem } from "@/lib/eta/types";

export type GeoPoint = {
  lat: number;
  lng: number;
};

export type NearbyStop = {
  stop: KmbStopSearchItem;
  distanceMeters: number;
};

const EARTH_RADIUS_METERS = 6371000;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMeters(a: GeoPoint, b: GeoPoint) {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const dLat = lat2 - lat1;
  const dLng = toRadians(b.lng - a.lng);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_METERS * c;
}

export function getNearbyStops(
  stops: KmbStopSearchItem[],
  location: GeoPoint,
  options?: {
    limit?: number;
    maxDistanceMeters?: number;
  }
): NearbyStop[] {
  const limit = options?.limit ?? 8;
  const maxDistanceMeters = options?.maxDistanceMeters ?? 1500;

  const withDistance = stops
    .filter((stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.lng))
    .map((stop) => ({
      stop,
      distanceMeters: distanceMeters(location, { lat: stop.lat, lng: stop.lng }),
    }))
    .filter((entry) => entry.distanceMeters <= maxDistanceMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  return withDistance.slice(0, limit);
}
