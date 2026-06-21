'use client'

import { GoogleMap, LoadScript, Marker, Polyline } from '@react-google-maps/api'
import { MapPin } from 'lucide-react'
import * as React from 'react'

import { env } from '@/lib/env'
import { cn } from '@/lib/utils'

const mapContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  minHeight: '16rem',
  borderRadius: '1rem',
}

const defaultCenter = { lat: 22.3193, lng: 114.1694 }

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

export function TransitMap({
  center = defaultCenter,
  markers = [],
  polylines = [],
  zoom = 14,
  className,
  userLocation,
}: Props) {
  const apiKey = env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    return (
      <div
        className={cn(
          'bg-surface-container-low text-on-surface-variant flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-6 text-center',
          className
        )}
        style={{ minHeight: '16rem' }}
      >
        <MapPin className="h-8 w-8 opacity-50" />
        <p className="m3-body-md max-w-xs">
          Google Maps is not configured. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable the map.
        </p>
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-hidden rounded-2xl', className)}>
      <LoadScript googleMapsApiKey={apiKey}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={zoom}
          options={{
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          }}
        >
          {userLocation && (
            <Marker
              position={userLocation}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#005db6',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              }}
            />
          )}
          {markers.map((marker) => (
            <Marker
              key={marker.id}
              position={{ lat: marker.lat, lng: marker.lng }}
              title={marker.title}
            />
          ))}
          {polylines.map((line) => (
            <Polyline
              key={line.id}
              path={line.path}
              options={{
                strokeColor: line.color ?? '#00478d',
                strokeOpacity: 0.9,
                strokeWeight: 4,
              }}
            />
          ))}
        </GoogleMap>
      </LoadScript>
    </div>
  )
}
