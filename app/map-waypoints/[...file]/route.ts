import { NextRequest } from 'next/server'

import { env } from '@/lib/env'

/**
 * Same-origin passthrough for hkbus route-waypoint geometry files.
 *
 * Purpose: the direct-fetch transport rule assumes the phone can reach every
 * upstream host, but some mobile networks (and VPNs on them) block
 * github.io / other third parties — the map tiles already work around this
 * by being served same-origin; waypoint geometry cannot be vendored at build
 * time because the files are selected per route variant at runtime. Running
 * on the edge with a long Cache-Control keeps the data pipeline
 * direct-fetch shaped (the client code is unchanged) while removing the
 * third-party dependency. Still an upstream fetcher override-able via env
 * for self-hosted mirrors.
 */

const UPSTREAM_BASE = env.NEXT_PUBLIC_ROUTE_WAYPOINTS_UPSTREAM_URL

export const runtime = 'edge'

export const revalidate = 86_400

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ file: string[] }> }
) {
  const { file } = await params
  // encodeURIComponent('..') === '..', so traversal must be rejected
  // explicitly — the waypoint dataset is flat single files.
  if (
    !file ||
    file.length === 0 ||
    file.some((s) => !s || s === '.' || s === '..' || s.includes('/') || s.includes('\\'))
  ) {
    return new Response('Unsupported waypoint path', { status: 400 })
  }
  const relative = file.map(encodeURIComponent).join('/')
  if (!relative.endsWith('.json')) {
    return new Response('Unsupported waypoint path', { status: 400 })
  }
  const upstream = `${UPSTREAM_BASE.replace(/\/+$/, '')}/${relative}`
  try {
    const response = await fetch(upstream, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) {
      return new Response(null, { status: response.status === 404 ? 404 : 502 })
    }
    const body = await response.arrayBuffer()
    return new Response(body, {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    })
  } catch {
    return new Response(null, { status: 502 })
  }
}
