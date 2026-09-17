'use client'

import type * as L from 'leaflet'
import * as React from 'react'

import 'leaflet/dist/leaflet.css'

import { markPerf, measurePerf } from '@/lib/eta/perf'
import { cn } from '@/lib/utils'

type LeafletMod = typeof import('leaflet')

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const TILE_MAX_ZOOM = 17

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

function createStopIcon(Lmod: LeafletMod): L.DivIcon {
  return Lmod.divIcon({
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
  const leafletRef = React.useRef<LeafletMod | null>(null)
  const markerLayerRef = React.useRef<L.LayerGroup | null>(null)
  const polylineLayerRef = React.useRef<L.LayerGroup | null>(null)
  const userLocationLayerRef = React.useRef<L.LayerGroup | null>(null)
  const [mapReady, setMapReady] = React.useState(false)

  const initialCenterRef = React.useRef(center)
  const initialZoomRef = React.useRef(zoom)
  const lastAppliedCenterRef = React.useRef<{ lat: number; lng: number } | null>(null)
  const lastAppliedZoomRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    let cancelled = false
    let map: L.Map | null = null
    let resizeObserver: ResizeObserver | null = null
    let raf = 0
    markPerf('map:mount-start')

    async function init() {
      if (!containerRef.current || mapRef.current) return
      let mod: LeafletMod
      try {
        mod = await import('leaflet')
      } catch {
        return
      }
      const container = containerRef.current
      if (cancelled || !container || mapRef.current) return
      leafletRef.current = mod

      map = mod.map(container, {
        center: [initialCenterRef.current.lat, initialCenterRef.current.lng],
        zoom: initialZoomRef.current,
        zoomControl: false,
        attributionControl: true,
        preferCanvas: true,
      })
      mapRef.current = map

      mod
        .tileLayer(TILE_URL, {
          maxZoom: TILE_MAX_ZOOM,
          attribution: TILE_ATTRIBUTION,
          keepBuffer: 2,
          updateWhenIdle: true,
        })
        .addTo(map)

      markerLayerRef.current = mod.layerGroup().addTo(map)
      polylineLayerRef.current = mod.layerGroup().addTo(map)
      userLocationLayerRef.current = mod.layerGroup().addTo(map)

      lastAppliedCenterRef.current = initialCenterRef.current
      lastAppliedZoomRef.current = initialZoomRef.current

      raf = requestAnimationFrame(() => map?.invalidateSize())
      resizeObserver =
        typeof ResizeObserver !== 'undefined'
          ? new ResizeObserver(() => map?.invalidateSize())
          : null
      resizeObserver?.observe(container)

      if (!cancelled) {
        setMapReady(true)
        measurePerf('map:mount', 'map:mount-start')
      }
    }

    void init()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      resizeObserver?.disconnect()
      markerLayerRef.current = null
      polylineLayerRef.current = null
      userLocationLayerRef.current = null
      map?.remove()
      mapRef.current = null
      leafletRef.current = null
      setMapReady(false)
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
    const Lmod = leafletRef.current
    if (!layer || !Lmod) return
    layer.clearLayers()
    const icon = createStopIcon(Lmod)
    for (const marker of markers) {
      Lmod.marker([marker.lat, marker.lng], { icon, title: marker.title ?? '' }).addTo(layer)
    }
  }, [markers, mapReady])

  React.useEffect(() => {
    const layer = polylineLayerRef.current
    const Lmod = leafletRef.current
    if (!layer || !Lmod) return
    layer.clearLayers()
    for (const line of polylines) {
      Lmod.polyline(
        line.path.map((p) => [p.lat, p.lng] as [number, number]),
        { color: line.color ?? POLYLINE_DEFAULT_COLOR, weight: 4, opacity: 0.9 }
      ).addTo(layer)
    }
  }, [polylines, mapReady])

  React.useEffect(() => {
    const layer = userLocationLayerRef.current
    const Lmod = leafletRef.current
    if (!layer || !Lmod) return
    layer.clearLayers()
    if (userLocation) {
      Lmod.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 8,
        color: '#ffffff',
        weight: 2,
        fillColor: USER_LOCATION_COLOR,
        fillOpacity: 1,
      }).addTo(layer)
    }
  }, [userLocation, mapReady])

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
