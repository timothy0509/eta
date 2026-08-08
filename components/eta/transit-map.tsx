'use client'

import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import * as React from 'react'

import { cn } from '@/lib/utils'

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const TILE_MAX_ZOOM = 19

const DEFAULT_CENTER = { lat: 22.3193, lng: 114.1694 }

const STOP_COLOR = '#00478d'
const USER_LOCATION_COLOR = '#005db6'
const POLYLINE_DEFAULT_COLOR = '#00478d'

const EMPTY_MARKERS: MapMarker[] = []
const EMPTY_POLYLINES: MapPolyline[] = []

export type MapMarker = {
  id: string
  lat: number
  lng: number
  title?: string
}

export type MapPolyline = {
  id: string
  path: Array<{ lat: number; lng: number }>
  color?: string
}

type Props = {
  center?: { lat: number; lng: number }
  markers?: MapMarker[]
  polylines?: MapPolyline[]
  zoom?: number
  className?: string
  userLocation?: { lat: number; lng: number } | null
}

function createStopIcon(): L.DivIcon {
  return L.divIcon({
    className: 'transit-map-stop-icon',
    html: [
      '<span style="display:block;width:26px;height:26px">',
      `<svg viewBox="0 0 24 24" width="26" height="26" style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3))">`,
      `<path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z" fill="${STOP_COLOR}" stroke="#fff" stroke-width="1.5"/>`,
      `<circle cx="12" cy="9" r="2.6" fill="#fff"/>`,
      '</svg>',
      '</span>',
    ].join(''),
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  })
}

function samePosition(
  a: { lat: number; lng: number } | null,
  b: { lat: number; lng: number } | null
): boolean {
  return !!a && !!b && a.lat === b.lat && a.lng === b.lng
}

export function TransitMap({
  center = DEFAULT_CENTER,
  markers = EMPTY_MARKERS,
  polylines = EMPTY_POLYLINES,
  zoom = 14,
  className,
  userLocation,
}: Props) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<L.Map | null>(null)
  const markerLayerRef = React.useRef<L.LayerGroup | null>(null)
  const polylineLayerRef = React.useRef<L.LayerGroup | null>(null)
  const userLocationLayerRef = React.useRef<L.LayerGroup | null>(null)

  const initialCenterRef = React.useRef(center)
  const initialZoomRef = React.useRef(zoom)
  const lastAppliedCenterRef = React.useRef<{ lat: number; lng: number } | null>(null)
  const lastAppliedZoomRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    const container = containerRef.current
    if (!container || mapRef.current) return

    const map = L.map(container, {
      center: [initialCenterRef.current.lat, initialCenterRef.current.lng],
      zoom: initialZoomRef.current,
      zoomControl: false,
      attributionControl: true,
    })
    mapRef.current = map

    L.tileLayer(TILE_URL, { maxZoom: TILE_MAX_ZOOM, attribution: TILE_ATTRIBUTION }).addTo(map)

    markerLayerRef.current = L.layerGroup().addTo(map)
    polylineLayerRef.current = L.layerGroup().addTo(map)
    userLocationLayerRef.current = L.layerGroup().addTo(map)

    lastAppliedCenterRef.current = initialCenterRef.current
    lastAppliedZoomRef.current = initialZoomRef.current

    const raf = requestAnimationFrame(() => map.invalidateSize())
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => map.invalidateSize()) : null
    resizeObserver?.observe(container)

    return () => {
      cancelAnimationFrame(raf)
      resizeObserver?.disconnect()
      markerLayerRef.current = null
      polylineLayerRef.current = null
      userLocationLayerRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (samePosition(lastAppliedCenterRef.current, center) && lastAppliedZoomRef.current === zoom) {
      return
    }
    lastAppliedCenterRef.current = center
    lastAppliedZoomRef.current = zoom
    map.setView([center.lat, center.lng], zoom)
  }, [center, zoom])

  React.useEffect(() => {
    const layer = markerLayerRef.current
    if (!layer) return
    layer.clearLayers()
    const icon = createStopIcon()
    for (const marker of markers) {
      L.marker([marker.lat, marker.lng], { icon, title: marker.title ?? '' }).addTo(layer)
    }
  }, [markers])

  React.useEffect(() => {
    const layer = polylineLayerRef.current
    if (!layer) return
    layer.clearLayers()
    for (const line of polylines) {
      L.polyline(
        line.path.map((p) => [p.lat, p.lng] as [number, number]),
        { color: line.color ?? POLYLINE_DEFAULT_COLOR, weight: 4, opacity: 0.9 }
      ).addTo(layer)
    }
  }, [polylines])

  React.useEffect(() => {
    const layer = userLocationLayerRef.current
    if (!layer) return
    layer.clearLayers()
    if (userLocation) {
      L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 8,
        color: '#ffffff',
        weight: 2,
        fillColor: USER_LOCATION_COLOR,
        fillOpacity: 1,
      }).addTo(layer)
    }
  }, [userLocation])

  return (
    <div className={cn('relative z-0 overflow-hidden rounded-2xl', className)}>
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ minHeight: '16rem', borderRadius: '1rem' }}
      />
    </div>
  )
}
