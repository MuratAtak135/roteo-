import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VERSO_KEY = Deno.env.get('VERSO_API_KEY') ?? ''

function timeToTimestamp(t: string, dayOffset: number = 0): number {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  const [h, m] = t.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return Math.floor(d.getTime() / 1000)
}

function timestampToTime(ts: number): string {
  const d = new Date(ts * 1000)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

// Polyline decode (Verso'nun geometry formatı)
function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = []
  let index = 0, lat = 0, lng = 0

  while (index < encoded.length) {
    let shift = 0, result = 0, byte: number
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    const dlat = (result & 1) ? ~(result >> 1) : result >> 1
    lat += dlat

    shift = 0; result = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    const dlng = (result & 1) ? ~(result >> 1) : result >> 1
    lng += dlng

    coords.push([lng / 1e5, lat / 1e5]) // GeoJSON: [lng, lat]
  }
  return coords
}

interface Stop {
  id: string
  lat: number
  lng: number
  priority: number
  time_window_start: string
  time_window_end: string
  service_duration_min: number
  weight_kg: number
  parcel_count: number
  name: string
  address: string
}

interface Vehicle {
  id: string
  depot_lat: number
  depot_lng: number
  depot_address: string
  end_depot_lat?: number
  end_depot_lng?: number
  return_to_depot: boolean
  max_weight_kg: number
  max_parcels: number
  cost_per_km: number
  start_time: string
  end_time: string
  name: string
  max_days: number
  enable_breaks: boolean
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { stops, vehicles }: { stops: Stop[], vehicles: Vehicle[] } = await req.json()

    if (!stops || !vehicles || stops.length === 0 || vehicles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Durak ve araç gerekli' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const maxDays = Math.max(...vehicles.map(v => v.max_days || 1))

    const vroomJobs = stops.map((stop, i) => {
      const windows: number[][] = []
      for (let day = 0; day < maxDays; day++) {
        windows.push([
          timeToTimestamp(stop.time_window_start, day),
          timeToTimestamp(stop.time_window_end, day)
        ])
      }
      return {
        id: i,
        location: [stop.lng, stop.lat],
        service: stop.service_duration_min * 60,
        time_windows: windows,
        priority: stop.priority === 1 ? 100 : stop.priority === 2 ? 50 : 10,
      }
    })

    const vroomVehicles = vehicles.map((v, i) => {
      const days = v.max_days || 1
      const obj: any = {
        id: i,
        start: [v.depot_lng, v.depot_lat],
        time_window: [
          timeToTimestamp(v.start_time, 0),
          timeToTimestamp(v.end_time, days - 1),
        ],
      }

      if (v.return_to_depot) {
        obj.end = [v.depot_lng, v.depot_lat]
      } else if (v.end_depot_lat && v.end_depot_lng) {
        obj.end = [v.end_depot_lng, v.end_depot_lat]
      }

      if (v.enable_breaks && days >= 1) {
        const breaks = []
        for (let day = 0; day < days; day++) {
          breaks.push({
            id: day * 10 + 1,
            service: 45 * 60,
            time_windows: [[
              timeToTimestamp('12:00', day),
              timeToTimestamp('14:00', day)
            ]],
          })
          if (day < days - 1) {
            breaks.push({
              id: day * 10 + 2,
              service: 11 * 3600,
              time_windows: [[
                timeToTimestamp('20:00', day),
                timeToTimestamp('22:00', day)
              ]],
            })
          }
        }
        obj.breaks = breaks
      }

      return obj
    })

    const versoRes = await fetch(
      `https://api.verso-optim.com/vrp/v1/solve?api_key=${VERSO_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobs: vroomJobs, vehicles: vroomVehicles }),
      }
    )

    if (!versoRes.ok) {
      const errText = await versoRes.text()
      return new Response(
        JSON.stringify({ error: `Verso API hatası: ${errText}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const vroomResult = await versoRes.json()

    if (vroomResult.code !== 0) {
      return new Response(
        JSON.stringify({ error: vroomResult.error || 'Optimizasyon başarısız' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const routes = vroomResult.routes.map((route: any) => {
      const vehicle = vehicles[route.vehicle]

      const routeStops = route.steps
        .filter((step: any) => step.type === 'job')
        .map((step: any) => {
          const stop = stops[step.id]
          return {
            ...stop,
            arrival: timestampToTime(step.arrival),
            departure: timestampToTime(step.arrival + (step.service ?? 0)),
            late: (step.violations ?? []).some((v: any) => v.cause === 'lead_time'),
          }
        })

      const breaks = (route.steps ?? [])
        .filter((step: any) => step.type === 'break')
        .map((step: any) => ({
          arrival: timestampToTime(step.arrival),
          duration_min: Math.round((step.service ?? 0) / 60),
          type: (step.service ?? 0) > 4 * 3600 ? 'overnight' : 'lunch',
        }))

      const totalDist = (route.distance ?? 0) / 1000

      // Verso'nun polyline geometrisini GeoJSON'a çevir
      let geometry: any = null
      if (route.geometry) {
        const coords = decodePolyline(route.geometry)
        geometry = {
          type: 'LineString',
          coordinates: coords,
        }
      }

      return {
        vehicle_id: vehicle.id,
        vehicle_name: vehicle.name,
        stops: routeStops,
        breaks,
        total_distance_km: Math.round(totalDist * 10) / 10,
        total_duration_min: Math.round((route.duration ?? 0) / 60),
        total_duration_hours: Math.round((route.duration ?? 0) / 360) / 10,
        total_weight_kg: routeStops.reduce((s: number, r: any) => s + (r.weight_kg ?? 0), 0),
        total_parcels: routeStops.reduce((s: number, r: any) => s + (r.parcel_count ?? 0), 0),
        total_cost: vehicle.cost_per_km > 0 ? Math.round(totalDist * vehicle.cost_per_km) : null,
        estimated_return: timestampToTime(
          timeToTimestamp(vehicle.start_time, 0) + (route.duration ?? 0)
        ),
        days_used: 1,
        geometry,
      }
    })

    const unassigned = (vroomResult.unassigned ?? []).map((u: any) => stops[u.id])

    return new Response(
      JSON.stringify({
        routes,
        unassigned,
        summary: {
          total_distance_km: Math.round(routes.reduce((s: number, r: any) => s + r.total_distance_km, 0) * 10) / 10,
          total_cost: routes.every((r: any) => r.total_cost === null) ? null : routes.reduce((s: number, r: any) => s + (r.total_cost ?? 0), 0),
          total_stops: routes.reduce((s: number, r: any) => s + r.stops.length, 0),
          unassigned_count: unassigned.length,
          vehicles_used: routes.filter((r: any) => r.stops.length > 0).length,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})