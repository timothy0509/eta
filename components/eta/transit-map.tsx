'use client'

import 'maplibre-gl/dist/maplibre-gl.css'

import * as React from 'react'
import { useTheme } from 'next-themes'
import type {
  LayerSpecification,
  Map as MapLibreMap,
  MapGeoJSONFeature,
  StyleImageSource,
} from 'maplibre-gl'

type LineLayerSpec = Extract<LayerSpecification, { type: 'line' }>
type FillLayerSpec = Extract<LayerSpecification, { type: 'fill' }>
type CircleLayerSpec = Extract<LayerSpecification, { type: 'circle' }>
type SymbolLayerSpec = Extract<LayerSpecification, { type: 'symbol' }>

import { registerMapPmtilesProtocol } from '@/lib/eta/direct/map-pmtiles'
import { checkMapTileArchiveHealth, MAP_TILE_ARCHIVE_URL } from '@/lib/eta/direct/map-tiles'
import { geodesicCircleRing } from '@/lib/eta/geo'
import {
  basemapLabelLangForUi,
  buildBaseMapStyle,
  overlayPalette,
  type MapTheme,
} from '@/lib/eta/map-style'
import { markPerf, measurePerf } from '@/lib/eta/perf'
import type { UiLanguage } from '@/lib/eta/types'
import { cn } from '@/lib/utils'

export type MapMarker = {
  id: string
  lat: number
  lng: number
  title?: string
  selected?: boolean
}

export type MapPolyline = {
  id: string
  path: Array<{ lat: number; lng: number }>
  color?: string
}

export type MapUserLocation = {
  lat: number
  lng: number
  /** GPS accuracy in metres; renders the geodesic accuracy ring when present. */
  accuracyM?: number
}

export type TransitMapProps = {
  lang: UiLanguage
  center?: { lat: number; lng: number }
  markers?: MapMarker[]
  polylines?: MapPolyline[]
  zoom?: number
  className?: string
  userLocation?: MapUserLocation | null
  onMarkerClick?: (id: string) => void
  /**
   * Fit the content extent whenever this key changes (e.g. route variant),
   * instead of following the center/zoom props.
   */
  fitKey?: string | null
  /** Fly to this point when its identity changes (stop selection, follow mode). */
  focusPoint?: { lat: number; lng: number; zoom?: number } | null
  ariaLabel?: string
}

const DEFAULT_CENTER = { lat: 22.3193, lng: 114.1694 }

const EMPTY_MARKERS: MapMarker[] = []
const EMPTY_POLYLINES: MapPolyline[] = []

// Sources / layers for our own GeoJSON overlays.
const ROUTE_SOURCE = 'timoeta-route'
const STOPS_SOURCE = 'timoeta-stops'
const USER_SOURCE = 'timoeta-user'
const ARROW_IMAGE_ID = 'timoeta-route-arrow'

function stopFeature(marker: MapMarker): GeoJSON.Feature {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [marker.lng, marker.lat] },
    properties: {
      id: marker.id,
      title: marker.title ?? '',
      selected: marker.selected === true,
    },
    id: marker.id,
  }
}

function routeFeature(line: MapPolyline): GeoJSON.Feature | null {
  if (line.path.length < 2) return null
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: line.path.map((point) => [point.lng, point.lat]),
    },
    properties: line.color ? { id: line.id, color: line.color } : { id: line.id },
    // The 'color' property must stay absent when the line has no explicit
    // color: painting ['coalesce', ['get','color'], palette.routeMain] with
    // an empty-string property resolves to '' and drops the line.
  }
}

function userFeatures(user: MapUserLocation | null): GeoJSON.Feature[] {
  if (!user) return []
  const features: GeoJSON.Feature[] = [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [user.lng, user.lat] },
      properties: { kind: 'dot' },
    },
  ]
  const accuracyKm = user.accuracyM && user.accuracyM > 0 ? user.accuracyM / 1000 : null
  const ring = accuracyKm ? geodesicCircleRing(user, accuracyKm) : []
  if (ring.length > 3) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ring] },
      properties: { kind: 'accuracy' },
    })
  }
  return features
}

/** Small filled triangle rendered as pixels; line symbols orient along the road. */
function makeArrowImage(body: string, outline: string): StyleImageSource | null {
  if (typeof document === 'undefined') return null
  const size = 16
  const ratio = 2
  const canvas = document.createElement('canvas')
  canvas.width = size * ratio
  canvas.height = size * ratio
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(ratio, ratio)
  ctx.beginPath()
  // Tip points up, matching hkbus's arrow sprite. Their style pairs this
  // with icon-rotate: 90 (see the arrow layer below), which is what aligns
  // the rendered arrow along the direction of travel.
  ctx.moveTo(size / 2, 3.5)
  ctx.lineTo(size - 2.5, size - 2.5)
  ctx.lineTo(size / 2, size - 5.5)
  ctx.lineTo(2.5, size - 2.5)
  ctx.closePath()
  ctx.fillStyle = body
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = outline
  ctx.stroke()
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
  // The {width, height, data} image source branch carries no pixelRatio, so
  // the retina-scaled icon relies on this extra metadata field.
  const image = {
    width: canvas.width,
    height: canvas.height,
    data: pixels.data,
    pixelRatio: ratio,
  }
  return image as unknown as StyleImageSource
}

function ensureArrowImage(map: MapLibreMap, theme: MapTheme): void {
  if (map.hasImage(ARROW_IMAGE_ID)) map.removeImage(ARROW_IMAGE_ID)
  const palette = overlayPalette(theme)
  const icon = makeArrowImage(palette.routeMain, palette.routeCasing)
  if (icon) map.addImage(ARROW_IMAGE_ID, icon)
}

function setGeojsonSource(map: MapLibreMap, id: string, features: GeoJSON.Feature[]): void {
  const source = map.getSource(id)
  if (source?.type !== 'geojson') return
  ;(source as unknown as { setData: (data: GeoJSON.FeatureCollection) => void }).setData({
    type: 'FeatureCollection',
    features,
  })
}

function syncOverlayData(
  map: MapLibreMap,
  data: {
    markers: MapMarker[]
    polylines: MapPolyline[]
    userLocation: MapUserLocation | null
  }
): void {
  setGeojsonSource(map, STOPS_SOURCE, data.markers.map(stopFeature))
  setGeojsonSource(
    map,
    ROUTE_SOURCE,
    data.polylines.flatMap((line) => {
      const feature = routeFeature(line)
      return feature ? [feature] : []
    })
  )
  setGeojsonSource(map, USER_SOURCE, userFeatures(data.userLocation))
}

/**
 * Adds our overlay sources/layers after every style load: the initial load
 * and each setStyle() call (theme/language switch) both land here. A fresh
 * style object drops sources, so this is fully idempotent and relies on the
 * caller to re-sync data afterwards.
 */
function ensureOverlayLayers(map: MapLibreMap, theme: MapTheme): void {
  const palette = overlayPalette(theme)

  for (const id of [ROUTE_SOURCE, STOPS_SOURCE, USER_SOURCE]) {
    if (map.getSource(id)) map.removeSource(id)
  }
  const emptyCollection: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
  map.addSource(ROUTE_SOURCE, { type: 'geojson', data: emptyCollection })
  map.addSource(STOPS_SOURCE, { type: 'geojson', data: emptyCollection })
  map.addSource(USER_SOURCE, { type: 'geojson', data: emptyCollection })

  const accuracyFill: FillLayerSpec = {
    id: 'user-accuracy',
    type: 'fill',
    source: USER_SOURCE,
    filter: ['==', ['get', 'kind'], 'accuracy'],
    paint: { 'fill-color': palette.userAccuracy },
  }
  const accuracyStroke: LineLayerSpec = {
    id: 'user-accuracy-stroke',
    type: 'line',
    source: USER_SOURCE,
    filter: ['==', ['get', 'kind'], 'accuracy'],
    paint: { 'line-color': palette.userFill, 'line-width': 1.5, 'line-opacity': 0.5 },
  }
  const casing: LineLayerSpec = {
    id: 'route-casing',
    type: 'line',
    source: ROUTE_SOURCE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': palette.routeCasing,
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 5, 16, 11],
      'line-opacity': 0.95,
    },
  }
  const main: LineLayerSpec = {
    id: 'route-main',
    type: 'line',
    source: ROUTE_SOURCE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['coalesce', ['get', 'color'], palette.routeMain],
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2.5, 16, 7],
    },
  }
  const arrows: SymbolLayerSpec = {
    id: 'route-arrows',
    type: 'symbol',
    source: ROUTE_SOURCE,
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 140,
      'icon-image': ARROW_IMAGE_ID,
      'icon-rotate': 90,
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-padding': 4,
    },
  }
  const stops: CircleLayerSpec = {
    id: 'stops',
    type: 'circle',
    source: STOPS_SOURCE,
    paint: {
      'circle-color': [
        'case',
        ['==', ['get', 'selected'], true],
        palette.stopSelectedFill,
        palette.stopFill,
      ],
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 14, 5.5, 16, 7],
      'circle-stroke-color': [
        'case',
        ['==', ['get', 'selected'], true],
        palette.stopSelectedStroke,
        palette.stopStroke,
      ],
      'circle-stroke-width': 2,
    },
  }
  // Selected pins get their own layer: a zoom-aware radius cannot nest an
  // interpolate inside a case in the style spec, so the enlarged radius and
  // the thicker stroke live here instead.
  const stopsSelected: CircleLayerSpec = {
    id: 'stops-selected',
    type: 'circle',
    source: STOPS_SOURCE,
    filter: ['==', ['get', 'selected'], true],
    paint: {
      'circle-color': palette.stopSelectedFill,
      'circle-radius': 8,
      'circle-stroke-color': palette.stopSelectedStroke,
      'circle-stroke-width': 3,
    },
  }
  const stopLabel: SymbolLayerSpec = {
    id: 'stop-label',
    type: 'symbol',
    source: STOPS_SOURCE,
    minzoom: 13,
    filter: ['==', ['get', 'selected'], true],
    layout: {
      'text-field': ['get', 'title'],
      'text-font': ['Noto Sans Medium'],
      'text-size': 12,
      'text-offset': [0, 1.2],
      'text-anchor': 'top',
    },
    paint: {
      'text-color': palette.stopLabelText,
      'text-halo-color': palette.stopLabelHalo,
      'text-halo-width': 1.2,
    },
  }
  const userDot: CircleLayerSpec = {
    id: 'user-dot',
    type: 'circle',
    source: USER_SOURCE,
    filter: ['==', ['get', 'kind'], 'dot'],
    paint: {
      'circle-color': palette.userFill,
      'circle-radius': 7,
      'circle-stroke-color': palette.stopStroke,
      'circle-stroke-width': 2.5,
    },
  }

  map.addLayer(accuracyFill)
  map.addLayer(accuracyStroke)
  map.addLayer(casing)
  map.addLayer(main)
  map.addLayer(arrows)
  map.addLayer(stops)
  map.addLayer(stopsSelected)
  map.addLayer(stopLabel)
  map.addLayer(userDot)
}

function samePosition(
  a: { lat: number; lng: number } | null,
  b: { lat: number; lng: number } | null
): boolean {
  return !!a && !!b && a.lat === b.lat && a.lng === b.lng
}

/**
 * MapLibre GL map over our own Hong Kong PMTiles vector archive. One
 * component serves the nearby and route views; markers and route lines are
 * GeoJSON sources, so pin styling (selected stop, direction arrows, accuracy
 * ring) is declarative property-driven styling instead of one DOM node per pin.
 */
export function TransitMap({
  lang,
  center = DEFAULT_CENTER,
  markers = EMPTY_MARKERS,
  polylines = EMPTY_POLYLINES,
  zoom = 14,
  className,
  userLocation,
  onMarkerClick,
  fitKey,
  focusPoint,
  ariaLabel,
}: TransitMapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<MapLibreMap | null>(null)
  const maplibreRef = React.useRef<typeof import('maplibre-gl') | null>(null)
  const [mapReady, setMapReady] = React.useState(false)
  const [mapErrors, setMapErrors] = React.useState<string[]>([])

  const { resolvedTheme } = useTheme()
  const theme: MapTheme = resolvedTheme === 'dark' ? 'dark' : 'light'
  const labelLang = basemapLabelLangForUi(lang)

  const dataRef = React.useRef({ markers, polylines, userLocation: userLocation ?? null })
  React.useEffect(() => {
    dataRef.current = { markers, polylines, userLocation: userLocation ?? null }
  }, [markers, polylines, userLocation])

  const initialCenterRef = React.useRef(center)
  const initialZoomRef = React.useRef(zoom)
  const lastAppliedCenterRef = React.useRef<{ lat: number; lng: number } | null>(null)
  const lastAppliedZoomRef = React.useRef<number | null>(null)
  const lastFitKeyRef = React.useRef<string | null>(null)
  const lastFocusRef = React.useRef<{ lat: number; lng: number; zoom?: number } | null>(null)
  const onMarkerClickRef = React.useRef(onMarkerClick)
  React.useEffect(() => {
    onMarkerClickRef.current = onMarkerClick
  }, [onMarkerClick])

  const styleSpec = React.useMemo(() => buildBaseMapStyle(theme, labelLang), [theme, labelLang])

  React.useEffect(() => {
    let cancelled = false
    let resizeObserver: ResizeObserver | null = null
    let raf = 0
    markPerf('map:mount-start')

    async function init() {
      if (!containerRef.current || mapRef.current) return
      let maplibre: typeof import('maplibre-gl')
      try {
        const [gl, protocolReady] = await Promise.all([
          import('maplibre-gl'),
          registerMapPmtilesProtocol(),
        ])
        if (cancelled || !containerRef.current || mapRef.current) return
        maplibre = gl
        void protocolReady

        // MapLibre's automatic worker URL detection depends on resolving its
        // own bundle URL, which Next's chunked ESM output does not expose
        // (the resolved URL came back empty, so the worker was constructed
        // from ''). Point it at the bundler-emitted worker asset instead.
        try {
          const workerUrl = new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href
          if (workerUrl && !workerUrl.startsWith('file:')) {
            maplibre.setWorkerUrl(workerUrl)
          }
        } catch {
          // Leave the builtin fallback in place; worker failures surface
          // through maplibre's own error event either way.
        }
      } catch {
        return
      }
      const container = containerRef.current
      if (cancelled || !container || mapRef.current) return
      maplibreRef.current = maplibre

      const map = new maplibre.Map({
        container,
        center: [initialCenterRef.current.lng, initialCenterRef.current.lat],
        zoom: initialZoomRef.current,
        attributionControl: { compact: true },
        // Wheel hijacks page scroll while the cursor sits over the map card;
        // it is re-enabled by an explicit pointer interaction inside the map.
        scrollZoom: false,
        style: styleSpec,
      })
      mapRef.current = map

      map.on('error', (event) => {
        const detail = event && event.error ? String(event.error.message || event.error) : 'unknown'
        if (!cancelled) {
          setMapErrors((prev) => {
            const next = prev.includes(detail) ? prev : [...prev, detail].slice(-3)
            return next
          })
        }
      })

      map.on('style.load', () => {
        if (cancelled || !mapRef.current) return
        ensureOverlayLayers(mapRef.current, theme)
        ensureArrowImage(mapRef.current, theme)
        syncOverlayData(mapRef.current, dataRef.current)
      })

      map.on('click', 'stops', (event) => {
        const feature = event.features?.[0] as MapGeoJSONFeature | undefined
        const id = feature?.properties?.id
        if (typeof id === 'string' && id) onMarkerClickRef.current?.(id)
      })
      map.on('mouseenter', 'stops', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'stops', () => {
        map.getCanvas().style.cursor = ''
      })

      raf = requestAnimationFrame(() => map.resize())
      resizeObserver =
        typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => map.resize()) : null
      resizeObserver?.observe(container)

      if (!cancelled) {
        setMapReady(true)
        measurePerf('map:mount', 'map:mount-start')
      }
      if (process.env.NODE_ENV === 'development') {
        void checkMapTileArchiveHealth().then((health) => {
          if (health.ok) return
          const detail =
            health.reason === 'stale'
              ? `(age ${health.ageDays ?? '?'}d) — the scheduled hk-pmtiles-generation run may have stopped`
              : `— the tile archive is missing at ${MAP_TILE_ARCHIVE_URL}`
          console.warn(`[timoeta] map tile archive check failed: ${health.reason} ${detail}`)
        })
      }
    }

    void init()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      resizeObserver?.disconnect()
      mapRef.current?.remove()
      mapRef.current = null
      setMapReady(false)
    }
    // The map mounts once; style/theme changes go through setStyle below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    syncOverlayData(map, dataRef.current)
  }, [markers, polylines, userLocation, mapReady])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    map.setStyle(styleSpec, { diff: false })
  }, [styleSpec, mapReady])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    if (samePosition(lastAppliedCenterRef.current, center) && lastAppliedZoomRef.current === zoom) {
      return
    }
    lastAppliedCenterRef.current = center
    lastAppliedZoomRef.current = zoom
    map.jumpTo({ center: [center.lng, center.lat], zoom })
  }, [center, zoom, mapReady])

  React.useEffect(() => {
    const map = mapRef.current
    const maplibre = maplibreRef.current
    if (!map || !mapReady || !maplibre) return
    if (fitKey === null || fitKey === undefined || fitKey === lastFitKeyRef.current) return
    lastFitKeyRef.current = fitKey
    const bounds = new maplibre.LngLatBounds()
    let hasPoints = false
    for (const marker of dataRef.current.markers) {
      bounds.extend([marker.lng, marker.lat])
      hasPoints = true
    }
    for (const line of dataRef.current.polylines) {
      for (const point of line.path) {
        bounds.extend([point.lng, point.lat])
        hasPoints = true
      }
    }
    if (hasPoints) map.fitBounds(bounds, { padding: 48, maxZoom: 14.5 })
  }, [fitKey, mapReady, markers, polylines])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    if (!focusPoint) {
      lastFocusRef.current = null
      return
    }
    const last = lastFocusRef.current
    if (last && samePosition(last, focusPoint) && last.zoom === focusPoint.zoom) return
    lastFocusRef.current = focusPoint
    map.flyTo({
      center: [focusPoint.lng, focusPoint.lat],
      zoom: focusPoint.zoom ?? map.getZoom(),
      duration: 600,
    })
  }, [focusPoint, mapReady])

  const handlePointerDown = React.useCallback(() => {
    mapRef.current?.scrollZoom.enable()
  }, [])

  const handleMouseLeave = React.useCallback(() => {
    mapRef.current?.scrollZoom.disable()
  }, [])

  return (
    <div className={cn('relative z-0 overflow-hidden rounded-2xl', className)}>
      {mapErrors.length > 0 && (
        <div className="bg-surface-container/90 text-on-surface-variant pointer-events-none absolute right-2 bottom-8 z-10 max-w-[90%] rounded-lg px-2 py-1 font-mono text-[11px] leading-tight">
          {mapErrors.map((msg) => (
            <div key={msg} className="truncate" aria-hidden>
              {msg}
            </div>
          ))}
        </div>
      )}
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ minHeight: '16rem', borderRadius: '1rem' }}
        onPointerDown={handlePointerDown}
        onMouseLeave={handleMouseLeave}
        role="application"
        aria-label={ariaLabel}
      />
    </div>
  )
}
