import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const TOMTOM_KEY = import.meta.env.VITE_TOMTOM_API_KEY
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

interface Stop {
  id: string; name: string; address: string; lat: number; lng: number
  priority: 1 | 2 | 3; time_window_start: string; time_window_end: string
  service_duration_min: number; weight_kg: number; parcel_count: number
}
interface Depot { id: string; name: string; address: string; lat: number; lng: number }
interface Vehicle {
  id: string; name: string; plate: string; type: 'car' | 'van' | 'truck' | 'semi'
  max_weight_kg: number; max_parcels: number; depot_id: string
  end_depot_id: string | null; return_to_depot: boolean
  start_time: string; end_time: string; max_days: number
}
interface SearchResult { display_name: string; lat: string; lon: string }
interface RouteStop extends Stop { arrival: string; departure: string; late?: boolean }
interface OptimizedRoute {
  vehicle_id: string; vehicle_name: string; stops: RouteStop[]
  total_distance_km: number; total_duration_min: number
  color: string; geometry: GeoJSON.LineString | null
}
interface Summary { total_distance_km: number; total_stops: number; unassigned_count: number; vehicles_used: number }

const PR: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'Acil', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  2: { label: 'Normal', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  3: { label: 'Düşük', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
}
const VC: Record<string, { l: string; i: string }> = {
  car: { l: 'Otomobil', i: '🚗' }, van: { l: 'Kamyonet', i: '🚐' },
  truck: { l: 'Kamyon', i: '🚛' }, semi: { l: 'TIR', i: '🚜' },
}
const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

const C = {
  bg: '#181c27', bgPanel: '#1e2335', bgCard: '#242b3d', bgHover: '#2a3349',
  border: '#2e3854', borderLight: '#273045',
  text: '#dde3f0', textMuted: '#7b8ba8', textDim: '#3d4d6a',
  accent: '#3b82f6', accentL: 'rgba(59,130,246,0.1)', accentB: 'rgba(59,130,246,0.25)',
  success: '#22c55e', successL: 'rgba(34,197,94,0.08)',
  warning: '#f59e0b', warningL: 'rgba(245,158,11,0.08)',
  danger: '#ef4444', dangerL: 'rgba(239,68,68,0.08)',
  shadow: '0 8px 32px rgba(0,0,0,0.35)',
}

// URL builders
function buildGoogleMapsUrl(route: OptimizedRoute, depot: Depot | undefined, returnToDepot: boolean): string {
  const pts = [
    depot ? `${depot.lat},${depot.lng}` : '',
    ...route.stops.map(s => `${s.lat},${s.lng}`),
    returnToDepot && depot ? `${depot.lat},${depot.lng}` : '',
  ].filter(Boolean)
  return `https://www.google.com/maps/dir/${pts.join('/')}`
}

function ZapIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg> }
function PlusIcon({ s = 14 }: { s?: number }) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg> }
function XIcon({ s = 13 }: { s?: number }) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg> }
function MapIcon({ a }: { a?: boolean }) { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={a ? C.accent : C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" /><line x1="9" y1="3" x2="9" y2="18" /><line x1="15" y1="6" x2="15" y2="21" /></svg> }
function DepotIcon({ a }: { a?: boolean }) { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={a ? C.accent : C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg> }
function MenuIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg> }

function InfoBox({ icon, title, children, color = C.accent }: { icon: string; title: string; children: React.ReactNode; color?: string }) {
  const isW = color === C.warning, isS = color === C.success, isD = color === C.danger
  return (
    <div style={{ margin: '10px', padding: '12px 14px', borderRadius: '10px', background: isW ? C.warningL : isS ? C.successL : isD ? C.dangerL : C.accentL, border: `1px solid ${isW ? 'rgba(245,158,11,0.2)' : isS ? 'rgba(34,197,94,0.2)' : isD ? 'rgba(239,68,68,0.2)' : C.accentB}` }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color, marginBottom: '5px' }}>{icon} {title}</div>
      <div style={{ fontSize: '11px', color: C.textMuted, lineHeight: 1.65 }}>{children}</div>
    </div>
  )
}

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 16px' }}>
      <div style={{ fontSize: '32px', marginBottom: '10px', opacity: 0.3 }}>{icon}</div>
      <div style={{ fontSize: '14px', fontWeight: 600, color: C.text, marginBottom: '4px' }}>{title}</div>
      <div style={{ fontSize: '12px', color: C.textMuted }}>{sub}</div>
    </div>
  )
}

function Modal({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.bgPanel, borderRadius: '12px', padding: '22px', width: '100%', maxWidth: '460px', boxShadow: C.shadow, maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: '13px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: C.text }}>{title}</h2>
          {sub && <p style={{ margin: '4px 0 0', fontSize: '11px', color: C.textMuted }}>{sub}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, flex, children }: { label: string; flex?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ flex: flex ? 1 : undefined, display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {label && <label style={{ fontSize: '11px', fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>}
      {children}
    </div>
  )
}

function ModalActions({ onCancel, onSubmit, label }: { onCancel: () => void; onSubmit: () => void; label: string }) {
  return (
    <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
      <button onClick={onCancel} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${C.border}`, background: C.bgCard, color: C.textMuted, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>İptal</button>
      <button onClick={onSubmit} style={{ flex: 2, padding: '10px', borderRadius: '8px', border: 'none', background: C.accent, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>{label}</button>
    </div>
  )
}

export default function Dashboard() {
  const [page, setPage] = useState('plan')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const mapRef = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const markers = useRef<Record<string, maplibregl.Marker>>({})
  const [mapReady, setMapReady] = useState(false)
  const [trafficOn, setTrafficOn] = useState(true)
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets')

  const [depots, setDepots] = useState<Depot[]>([])
  const [stops, setStops] = useState<Stop[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [routes, setRoutes] = useState<OptimizedRoute[]>([])
  const [unassigned, setUnassigned] = useState<Stop[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [optimizing, setOptimizing] = useState(false)
  const [optimError, setOptimError] = useState('')
  const [tab, setTab] = useState<'stops' | 'vehicles' | 'result'>('stops')
  const [orderedStopIds, setOrderedStopIds] = useState<string[]>([])
  const [showPanel, setShowPanel] = useState(true) // mobilde panel aç/kapat

  const [q, setQ] = useState('')
  const [qResults, setQResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const qTimer = useRef<ReturnType<typeof setTimeout>>()

  const [pendingLoc, setPendingLoc] = useState<{ lat: number; lng: number; address: string } | null>(null)
  const [showStopModal, setShowStopModal] = useState(false)
  const [stopForm, setStopForm] = useState({ name: '', priority: 2, time_window_start: '09:00', time_window_end: '18:00', service_duration_min: 10, weight_kg: 0, parcel_count: 1 })

  const [showVehicleModal, setShowVehicleModal] = useState(false)
  const [vForm, setVForm] = useState<Omit<Vehicle, 'id'>>({ name: '', plate: '', type: 'van', max_weight_kg: 1000, max_parcels: 50, depot_id: '', end_depot_id: '', return_to_depot: true, start_time: '08:00', end_time: '18:00', max_days: 7 })
  const [vErrors, setVErrors] = useState<Record<string, string>>({})

  const [showDepotModal, setShowDepotModal] = useState(false)
  const [dForm, setDForm] = useState({ name: '', address: '', lat: 0, lng: 0 })
  const [dSearch, setDSearch] = useState('')
  const [dResults, setDResults] = useState<SearchResult[]>([])
  const [dErrors, setDErrors] = useState<Record<string, string>>({})
  const dTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const inp = (err?: string): React.CSSProperties => ({
    width: '100%', padding: '9px 11px', borderRadius: '7px',
    border: `1px solid ${err ? C.danger : C.border}`,
    fontSize: '13px', outline: 'none', boxSizing: 'border-box',
    color: C.text, background: C.bgCard, fontFamily: 'inherit',
  })

  const pBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', background: C.accent, color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }
  const sBtn: React.CSSProperties = { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'transparent', color: C.accent, border: `1.5px dashed ${C.accentB}`, borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }

  // MAP
  useEffect(() => {
    if (!mapRef.current || map.current) return
    map.current = new maplibregl.Map({
      container: mapRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [32.8597, 39.9334], zoom: 5.8,
    })
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.current.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right')
    map.current.on('load', () => { setMapReady(true); addTraffic() })
    map.current.on('click', async (e) => {
      const { lng, lat } = e.lngLat
      const addr = await revGeo(lat, lng)
      setPendingLoc({ lat, lng, address: addr })
      setStopForm(f => ({ ...f, name: addr.split(',')[0] }))
      setShowStopModal(true)
    })
    return () => { map.current?.remove(); map.current = null }
  }, [])

  useEffect(() => {
    if (page === 'plan' && map.current) setTimeout(() => map.current?.resize(), 100)
  }, [page, showPanel, isMobile])

  // MARKERS
  useEffect(() => {
    if (!map.current || !mapReady) return
    Object.keys(markers.current).forEach(id => {
      if (id.startsWith('stop_') || id.startsWith('depot_')) { markers.current[id].remove(); delete markers.current[id] }
    })
    depots.forEach(d => {
      const el = document.createElement('div')
      el.innerHTML = `<div style="width:34px;height:34px;border-radius:8px;background:#1e2335;border:2px solid #f59e0b;box-shadow:0 2px 12px rgba(245,158,11,0.3);display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;">🏭</div>`
      new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([d.lng, d.lat])
        .setPopup(new maplibregl.Popup({ offset: 18 }).setHTML(`<div style="padding:8px;font-family:sans-serif"><strong style="color:#111">${d.name}</strong><br/><span style="font-size:11px;color:#6b7280">${d.address.substring(0, 55)}</span></div>`))
        .addTo(map.current!)
      markers.current[`depot_${d.id}`] = new maplibregl.Marker({ element: el }).setLngLat([d.lng, d.lat])
    })
    stops.forEach(s => {
      const displayNum = orderedStopIds.length > 0
        ? (orderedStopIds.indexOf(s.id) >= 0 ? orderedStopIds.indexOf(s.id) + 1 : stops.indexOf(s) + 1)
        : stops.indexOf(s) + 1
      let markerColor = PR[s.priority].color
      if (orderedStopIds.length > 0) {
        for (const r of routes) {
          if (r.stops.some(rs => rs.id === s.id)) { markerColor = r.color; break }
        }
      }
      const el = document.createElement('div')
      el.innerHTML = `<div style="width:28px;height:28px;border-radius:50%;background:${markerColor};border:2.5px solid #181c27;box-shadow:0 2px 10px rgba(0,0,0,0.4);color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer;">${displayNum}</div>`
      const mLink = `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`
      const m = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([s.lng, s.lat])
        .setPopup(new maplibregl.Popup({ offset: 15 }).setHTML(`<div style="padding:8px;font-family:sans-serif;min-width:190px"><strong style="color:#111">${s.name}</strong><br/><span style="font-size:11px;color:#6b7280">${s.address.substring(0, 55)}</span><br/><a href="${mLink}" target="_blank" style="display:inline-block;margin-top:5px;font-size:11px;color:#2563eb;text-decoration:none;padding:3px 7px;background:#eff6ff;border-radius:4px;font-weight:600">Google Maps ↗</a></div>`))
        .addTo(map.current!)
      markers.current[`stop_${s.id}`] = m
    })
  }, [stops, depots, mapReady, orderedStopIds, routes])

  // ROUTES
  useEffect(() => {
    if (!map.current || !mapReady) return
    for (let i = 0; i < 20; i++) {
      if (map.current.getLayer(`r-${i}`)) map.current.removeLayer(`r-${i}`)
      if (map.current.getLayer(`r-${i}-bg`)) map.current.removeLayer(`r-${i}-bg`)
      if (map.current.getSource(`r-${i}`)) map.current.removeSource(`r-${i}`)
    }
    routes.forEach((r, i) => {
      if (!r.geometry) return
      map.current!.addSource(`r-${i}`, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: r.geometry } })
      map.current!.addLayer({ id: `r-${i}-bg`, type: 'line', source: `r-${i}`, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#000', 'line-width': 7, 'line-opacity': 0.15 } })
      map.current!.addLayer({ id: `r-${i}`, type: 'line', source: `r-${i}`, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': r.color, 'line-width': 4, 'line-opacity': 1 } })
    })
  }, [routes, mapReady])

  async function revGeo(lat: number, lng: number): Promise<string> {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=tr`)
      const d = await r.json()
      return d.display_name || `${lat.toFixed(5)},${lng.toFixed(5)}`
    } catch { return `${lat.toFixed(5)},${lng.toFixed(5)}` }
  }

  async function searchNom(query: string, type: 'stop' | 'depot') {
    if (!query || query.trim().length < 2) {
      if (type === 'stop') setQResults([])
      else setDResults([])
      return
    }
    if (type === 'stop') setSearching(true)
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=7&accept-language=tr&countrycodes=tr&addressdetails=1`
      const r = await fetch(url)
      const data = await r.json()
      if (type === 'stop') setQResults(data)
      else setDResults(data)
    } catch { /* ignore */ }
    if (type === 'stop') setSearching(false)
  }

  function onQChange(val: string) {
    setQ(val)
    clearTimeout(qTimer.current)
    if (val.trim().length >= 2) qTimer.current = setTimeout(() => searchNom(val, 'stop'), 200)
    else setQResults([])
  }

  function onDChange(val: string) {
    setDSearch(val)
    clearTimeout(dTimer.current)
    if (val.trim().length >= 2) dTimer.current = setTimeout(() => searchNom(val, 'depot'), 200)
    else setDResults([])
  }

  function addTraffic() {
    if (!map.current || map.current.getSource('traffic')) return
    map.current.addSource('traffic', { type: 'raster', tiles: [`https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${TOMTOM_KEY}`], tileSize: 256 })
    map.current.addLayer({ id: 'traffic-l', type: 'raster', source: 'traffic', paint: { 'raster-opacity': 0.7 } })
  }

  function toggleTraffic() {
    if (!map.current) return
    if (map.current.getLayer('traffic-l')) map.current.setLayoutProperty('traffic-l', 'visibility', trafficOn ? 'none' : 'visible')
    setTrafficOn(!trafficOn)
  }

  function toggleStyle() {
    if (!map.current) return
    const ns = mapStyle === 'streets' ? 'satellite' : 'streets'
    map.current.setStyle(ns === 'satellite' ? 'https://tiles.openfreemap.org/styles/positron' : 'https://tiles.openfreemap.org/styles/liberty')
    map.current.once('styledata', () => { addTraffic(); if (!trafficOn && map.current?.getLayer('traffic-l')) map.current.setLayoutProperty('traffic-l', 'visibility', 'none') })
    setMapStyle(ns)
  }

  function addStop() {
    if (!pendingLoc) return
    setStops(prev => [...prev, {
      id: crypto.randomUUID(), name: stopForm.name || pendingLoc.address.split(',')[0],
      address: pendingLoc.address, lat: pendingLoc.lat, lng: pendingLoc.lng,
      priority: stopForm.priority as 1 | 2 | 3,
      time_window_start: stopForm.time_window_start, time_window_end: stopForm.time_window_end,
      service_duration_min: stopForm.service_duration_min, weight_kg: stopForm.weight_kg, parcel_count: stopForm.parcel_count,
    }])
    setShowStopModal(false); setPendingLoc(null); setQ('')
  }

  function submitVehicle() {
    const errs: Record<string, string> = {}
    if (!vForm.name.trim()) errs.name = 'Araç adı giriniz'
    if (!vForm.depot_id) errs.depot = 'Depo seçiniz'
    setVErrors(errs)
    if (Object.keys(errs).length > 0) return
    setVehicles(prev => [...prev, { ...vForm, id: crypto.randomUUID() }])
    setShowVehicleModal(false); setVErrors({})
    setVForm({ name: '', plate: '', type: 'van', max_weight_kg: 1000, max_parcels: 50, depot_id: depots[0]?.id || '', end_depot_id: depots[0]?.id || '', return_to_depot: true, start_time: '08:00', end_time: '18:00', max_days: 7 })
  }

  function submitDepot() {
    const errs: Record<string, string> = {}
    if (!dForm.name.trim()) errs.name = 'Depo adı giriniz'
    if (!dForm.address || !dForm.lat) errs.address = 'Listeden bir adres seçiniz'
    setDErrors(errs)
    if (Object.keys(errs).length > 0) return
    setDepots(prev => [...prev, { ...dForm, id: crypto.randomUUID() }])
    setShowDepotModal(false); setDErrors({}); setDForm({ name: '', address: '', lat: 0, lng: 0 }); setDSearch('')
  }

  async function optimize() {
    if (stops.length < 2) { setOptimError('En az 2 durak gerekli.'); return }
    if (vehicles.length === 0) { setOptimError('En az 1 araç gerekli.'); return }
    if (depots.length === 0) { setOptimError('Önce depo ekleyin.'); return }
    setOptimizing(true); setOptimError(''); setRoutes([]); setUnassigned([]); setSummary(null); setOrderedStopIds([])
    try {
      const vwd = vehicles.map(v => {
        const sd = depots.find(d => d.id === v.depot_id) || depots[0]
        const ed = v.end_depot_id ? depots.find(d => d.id === v.end_depot_id) : null
        return { ...v, depot_lat: sd.lat, depot_lng: sd.lng, depot_address: sd.address, end_depot_lat: ed?.lat, end_depot_lng: ed?.lng }
      })
      const res = await fetch(`${SUPABASE_URL}/functions/v1/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ stops, vehicles: vwd }),
      })
      const data = await res.json()
      if (data.error) { setOptimError(data.error); setOptimizing(false); return }
      const newRoutes: OptimizedRoute[] = data.routes.map((r: any, i: number) => ({
        ...r, color: COLORS[i % COLORS.length], geometry: r.geometry || null,
      }))
      setRoutes(newRoutes)
      setUnassigned(data.unassigned || [])
      setSummary(data.summary)
      const ordered: string[] = newRoutes.flatMap(r => r.stops.map((s: RouteStop) => s.id))
      setOrderedStopIds(ordered)
      setTab('result')
      if (isMobile) setShowPanel(true)
      if (stops.length > 0) {
        const lngs = stops.map(s => s.lng), lats = stops.map(s => s.lat)
        map.current?.fitBounds([[Math.min(...lngs) - 0.2, Math.min(...lats) - 0.2], [Math.max(...lngs) + 0.2, Math.max(...lats) + 0.2]], { padding: 60 })
      }
    } catch { setOptimError('Bağlantı hatası.') }
    setOptimizing(false)
  }

  const canOpt = stops.length >= 2 && vehicles.length > 0 && depots.length > 0
  const navItems = [
    { id: 'plan', label: 'Rota Planlama', Icon: MapIcon },
    { id: 'depots', label: 'Depolar', Icon: DepotIcon },
  ]

  // Panel genişliği
  const panelWidth = isMobile ? '100%' : '360px'

  return (
    <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: C.bg, fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif', color: C.text, flexDirection: 'column' }}>

      {/* MOBILE TOPBAR */}
      {isMobile && (
        <div style={{ height: '52px', background: C.bgPanel, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0, zIndex: 50 }}>
          <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, display: 'flex', alignItems: 'center' }}>
            <MenuIcon />
          </button>
          <img src="/logo.png" alt="Atak Route" style={{ height: '32px', objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          <button onClick={optimize} disabled={optimizing || !canOpt} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: canOpt && !optimizing ? C.accent : C.bgCard, color: canOpt && !optimizing ? '#fff' : C.textDim, border: 'none', borderRadius: '7px', padding: '6px 10px', fontSize: '12px', fontWeight: 700, cursor: canOpt && !optimizing ? 'pointer' : 'not-allowed' }}>
            <ZapIcon />{optimizing ? '...' : 'Optimize'}
          </button>
        </div>
      )}

      {/* MOBILE SIDEBAR OVERLAY */}
      {isMobile && sidebarOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setSidebarOpen(false)} />
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '240px', background: C.bgPanel, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'center' }}>
              <img src="/logo.png" alt="Atak Route" style={{ height: '56px', objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            </div>
            <nav style={{ flex: 1, padding: '8px 0' }}>
              {navItems.map(({ id, label, Icon }) => (
                <button key={id} onClick={() => { setPage(id); setSidebarOpen(false) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '9px', padding: '12px 16px', background: page === id ? C.accentL : 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderLeft: page === id ? `2px solid ${C.accent}` : '2px solid transparent' }}>
                  <Icon a={page === id} />
                  <span style={{ fontSize: '14px', fontWeight: page === id ? 600 : 400, color: page === id ? C.accent : C.textMuted }}>{label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* DESKTOP SIDEBAR */}
        {!isMobile && (
          <aside style={{ width: '220px', background: C.bgPanel, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '20px 16px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'center' }}>
              <img src="/logo.png" alt="Atak Route" style={{ height: '80px', objectFit: 'contain', maxWidth: '190px' }}
                onError={e => { const t = e.target as HTMLImageElement; t.style.display = 'none'; const s = document.createElement('span'); s.style.cssText = 'font-size:18px;font-weight:800;color:#3b82f6'; s.textContent = 'Atak Route'; t.parentNode?.insertBefore(s, t) }} />
            </div>
            <nav style={{ flex: 1, padding: '8px 0' }}>
              {navItems.map(({ id, label, Icon }) => (
                <button key={id} onClick={() => setPage(id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '9px', padding: '10px 16px', background: page === id ? C.accentL : 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderLeft: page === id ? `2px solid ${C.accent}` : '2px solid transparent' }}>
                  <Icon a={page === id} />
                  <span style={{ fontSize: '13px', fontWeight: page === id ? 600 : 400, color: page === id ? C.accent : C.textMuted }}>{label}</span>
                </button>
              ))}
            </nav>
            <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.success }} />
              <span style={{ fontSize: '11px', color: C.textDim }}>Sistem Aktif</span>
            </div>
          </aside>
        )}

        {/* CONTENT */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* DESKTOP TOPBAR */}
          {!isMobile && (
            <header style={{ height: '54px', background: C.bgPanel, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0 }}>
              <div>
                <h1 style={{ fontSize: '14px', fontWeight: 700, color: C.text, margin: 0 }}>{navItems.find(n => n.id === page)?.label ?? 'Depolar'}</h1>
                <p style={{ fontSize: '11px', color: C.textDim, margin: '1px 0 0' }}>{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              {page === 'plan' && (
                <div style={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
                  <button onClick={toggleTraffic} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: C.bgCard, color: trafficOn ? C.success : C.textMuted, border: `1px solid ${trafficOn ? 'rgba(34,197,94,0.3)' : C.border}`, borderRadius: '7px', padding: '6px 11px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: trafficOn ? C.success : C.textDim }} />Trafik
                  </button>
                  <button onClick={toggleStyle} style={{ background: C.bgCard, color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: '7px', padding: '6px 11px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    {mapStyle === 'streets' ? '🛰 Uydu' : '🗺 Sokak'}
                  </button>
                  <button onClick={optimize} disabled={optimizing || !canOpt} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: canOpt && !optimizing ? C.accent : C.bgCard, color: canOpt && !optimizing ? '#fff' : C.textDim, border: 'none', borderRadius: '7px', padding: '7px 14px', fontSize: '13px', fontWeight: 700, cursor: canOpt && !optimizing ? 'pointer' : 'not-allowed' }}>
                    <ZapIcon />{optimizing ? 'Hesaplanıyor...' : 'Optimize Et'}
                  </button>
                </div>
              )}
            </header>
          )}

          {/* PLAN — harita her zaman DOM'da */}
          <div style={{ flex: 1, display: page === 'plan' ? 'flex' : 'none', overflow: 'hidden', flexDirection: isMobile ? 'column' : 'row' }}>

            {/* Mobil: panel toggle butonu */}
            {isMobile && (
              <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.bgPanel, flexShrink: 0 }}>
                <button onClick={() => setShowPanel(true)} style={{ flex: 1, padding: '10px', background: showPanel ? C.accentL : 'none', border: 'none', color: showPanel ? C.accent : C.textMuted, fontSize: '12px', fontWeight: 600, cursor: 'pointer', borderBottom: showPanel ? `2px solid ${C.accent}` : '2px solid transparent' }}>
                  📋 Panel
                </button>
                <button onClick={() => { setShowPanel(false); setTimeout(() => map.current?.resize(), 100) }} style={{ flex: 1, padding: '10px', background: !showPanel ? C.accentL : 'none', border: 'none', color: !showPanel ? C.accent : C.textMuted, fontSize: '12px', fontWeight: 600, cursor: 'pointer', borderBottom: !showPanel ? `2px solid ${C.accent}` : '2px solid transparent' }}>
                  🗺 Harita
                </button>
              </div>
            )}

            {/* LEFT PANEL */}
            <div style={{ width: isMobile ? '100%' : panelWidth, background: C.bgPanel, borderRight: isMobile ? 'none' : `1px solid ${C.border}`, display: isMobile ? (showPanel ? 'flex' : 'none') : 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>

              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}` }}>
                {([
                  { id: 'stops', l: 'Duraklar', c: stops.length },
                  { id: 'vehicles', l: 'Araçlar', c: vehicles.length },
                  { id: 'result', l: 'Sonuç', c: routes.length },
                ] as const).map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: '11px 4px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', color: tab === t.id ? C.accent : C.textMuted, borderBottom: tab === t.id ? `2px solid ${C.accent}` : '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    {t.l}
                    {t.c > 0 && <span style={{ background: tab === t.id ? C.accent : C.bgCard, color: tab === t.id ? '#fff' : C.textMuted, borderRadius: '10px', padding: '1px 6px', fontSize: '10px', fontWeight: 700 }}>{t.c}</span>}
                  </button>
                ))}
              </div>

              {/* STOPS */}
              {tab === 'stops' && (
                <>
                  {depots.length === 0 && (
                    <InfoBox icon="" title="Hoş geldiniz! Başlamak için:">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span>1. <span onClick={() => setPage('depots')} style={{ color: C.accent, cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}>Depolar</span> sayfasından depo ekleyin</span>
                        <span>2. Araçlar sekmesinden araç ekleyin</span>
                        <span>3. {isMobile ? 'Harita sekmesine geçip tıklayın' : 'Haritaya tıklayarak durak ekleyin'}</span>
                        <span>4. "Optimize Et" butonuna basın</span>
                      </div>
                    </InfoBox>
                  )}
                  {depots.length > 0 && vehicles.length === 0 && (
                    <InfoBox icon="🚛" title="Araç eklemeniz gerekiyor" color={C.warning}>
                      Araçlar sekmesine geçip en az 1 araç ekleyin.
                    </InfoBox>
                  )}
                  {depots.length > 0 && vehicles.length > 0 && stops.length === 0 && (
                    <InfoBox icon="📍" title="Harika! Şimdi durak ekleyin" color={C.success}>
                      {isMobile ? 'Harita sekmesine geçip haritaya tıklayın.' : 'Haritaya tıklayın veya aşağıdan adres arayın.'}
                    </InfoBox>
                  )}

                  <div style={{ padding: '10px', borderBottom: `1px solid ${C.borderLight}`, position: 'relative' }}>
                    <input value={q} onChange={e => onQChange(e.target.value)} placeholder="🔍 Tam ilçe veya mahalle adı yazın..." style={inp()} />
                    {searching && <div style={{ position: 'absolute', right: '18px', top: '20px', fontSize: '10px', color: C.textDim }}>aranıyor...</div>}
                    {qResults.length > 0 && (
                      <div style={{ position: 'absolute', zIndex: 100, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: '8px', boxShadow: C.shadow, width: 'calc(100% - 20px)', top: '100%', left: '10px', maxHeight: '250px', overflowY: 'auto' }}>
                        {qResults.map((r, i) => (
                          <div key={i} onClick={() => {
                            const lat = parseFloat(r.lat), lng = parseFloat(r.lon)
                            map.current?.flyTo({ center: [lng, lat], zoom: 14 })
                            setQ(r.display_name); setQResults([])
                            setPendingLoc({ lat, lng, address: r.display_name })
                            setStopForm(f => ({ ...f, name: r.display_name.split(',')[0] }))
                            setShowStopModal(true)
                            if (isMobile) setShowPanel(false)
                          }} style={{ padding: '9px 12px', cursor: 'pointer', fontSize: '12px', color: C.text, borderBottom: i < qResults.length - 1 ? `1px solid ${C.borderLight}` : 'none' }}
                            onMouseEnter={e => (e.currentTarget.style.background = C.bgHover)}
                            onMouseLeave={e => (e.currentTarget.style.background = C.bgCard)}>
                            📍 {r.display_name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                    {stops.length === 0
                      ? <EmptyState icon="📍" title="Durak yok" sub="Adres arayın veya haritaya tıklayın" />
                      : stops.map((s, i) => {
                        const pc = PR[s.priority]
                        return (
                          <div key={s.id} onClick={() => {
                            map.current?.flyTo({ center: [s.lng, s.lat], zoom: 15 })
                            markers.current[`stop_${s.id}`]?.togglePopup()
                            if (isMobile) setShowPanel(false)
                          }} style={{ padding: '10px 11px', borderRadius: '8px', cursor: 'pointer', marginBottom: '4px', background: C.bgCard, border: `1px solid ${C.borderLight}` }}
                            onMouseEnter={e => (e.currentTarget.style.background = C.bgHover)}
                            onMouseLeave={e => (e.currentTarget.style.background = C.bgCard)}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: pc.color, color: '#fff', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '13px', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                                  <div style={{ fontSize: '11px', color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.address}</div>
                                </div>
                              </div>
                              <button onClick={e => { e.stopPropagation(); setStops(p => p.filter(x => x.id !== s.id)); setOrderedStopIds(p => p.filter(id => id !== s.id)) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim, padding: '1px', display: 'flex' }}><XIcon /></button>
                            </div>
                            <div style={{ display: 'flex', gap: '5px', marginTop: '5px', marginLeft: '30px' }}>
                              <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: pc.bg, color: pc.color, fontWeight: 700 }}>{pc.label}</span>
                              <span style={{ fontSize: '10px', color: C.textMuted }}>⏱ {s.time_window_start}–{s.time_window_end}</span>
                              <span style={{ fontSize: '10px', color: C.textMuted }}>📦 {s.parcel_count}</span>
                            </div>
                          </div>
                        )
                      })}
                  </div>

                  {stops.length > 0 && (
                    <div style={{ padding: '10px', borderTop: `1px solid ${C.borderLight}` }}>
                      <button onClick={optimize} disabled={optimizing || !canOpt} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: canOpt && !optimizing ? C.accent : C.bgCard, color: canOpt && !optimizing ? '#fff' : C.textDim, border: 'none', borderRadius: '8px', padding: '11px', fontSize: '13px', fontWeight: 700, cursor: canOpt && !optimizing ? 'pointer' : 'not-allowed' }}>
                        <ZapIcon />{optimizing ? 'Hesaplanıyor...' : `${stops.length} Durağı Optimize Et`}
                      </button>
                      {optimError && <p style={{ fontSize: '11px', color: C.danger, margin: '5px 0 0', textAlign: 'center' }}>{optimError}</p>}
                    </div>
                  )}
                </>
              )}

              {/* VEHICLES */}
              {tab === 'vehicles' && (
                <>
                  {depots.length === 0 && (
                    <InfoBox icon="⚠️" title="Önce depo ekleyin" color={C.warning}>
                      <span onClick={() => { setPage('depots'); if (isMobile) setSidebarOpen(false) }} style={{ color: C.accent, cursor: 'pointer', fontWeight: 600 }}>Depolar sayfasına git →</span>
                    </InfoBox>
                  )}

                  <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                    {vehicles.length === 0
                      ? <EmptyState icon="🚛" title="Araç yok" sub={depots.length === 0 ? 'Önce depo ekleyin' : '"Araç Ekle" butonuna tıklayın'} />
                      : vehicles.map((v, i) => {
                        const sd = depots.find(d => d.id === v.depot_id)
                        return (
                          <div key={v.id} style={{ padding: '11px', borderRadius: '8px', background: C.bgCard, border: `1px solid ${C.borderLight}`, marginBottom: '5px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                                <span style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>{v.name}</span>
                                {v.plate && <span style={{ fontSize: '11px', color: C.textMuted }}>{v.plate}</span>}
                              </div>
                              <button onClick={() => setVehicles(p => p.filter(x => x.id !== v.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim }}><XIcon /></button>
                            </div>
                            <div style={{ fontSize: '11px', color: C.textMuted, lineHeight: 1.7, marginLeft: '14px' }}>
                              <div>{VC[v.type].i} {VC[v.type].l} • {v.max_weight_kg} kg • {v.start_time}–{v.end_time}</div>
                              <div>🏭 {sd?.name} {!v.return_to_depot ? '→ Açık rota' : ''}</div>
                              {v.max_days > 1 && <div style={{ color: C.warning }}>📅 {v.max_days} günlük</div>}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                  <div style={{ padding: '10px', borderTop: `1px solid ${C.borderLight}` }}>
                    <button onClick={() => { if (depots.length === 0) { alert('Önce depo ekleyin.'); return }; setVForm(f => ({ ...f, depot_id: depots[0].id, end_depot_id: depots[0].id })); setVErrors({}); setShowVehicleModal(true) }} style={sBtn}>
                      <PlusIcon s={13} /> Araç Ekle
                    </button>
                  </div>
                </>
              )}

              {/* RESULT */}
              {tab === 'result' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                  {routes.length === 0
                    ? <EmptyState icon="⚡" title="Sonuç yok" sub="Durak ve araç ekleyip optimize edin" />
                    : (
                      <>
                        <InfoBox icon="ℹ️" title="Demo Sürümü Hakkında">
                          Gösterilen süreler gerçek yol mesafesine dayalı tahmindir. Anlık trafik hesaba katılmamaktadır.
                        </InfoBox>

                        {summary && (
                          <div style={{ background: C.successL, border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', padding: '12px', margin: '4px 8px 8px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: C.success, marginBottom: '8px' }}>✓ Optimizasyon Tamamlandı</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                              <div><div style={{ fontSize: '10px', color: C.textMuted }}>Araç</div><div style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>{summary.vehicles_used}</div></div>
                              <div><div style={{ fontSize: '10px', color: C.textMuted }}>Durak</div><div style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>{summary.total_stops}</div></div>
                              <div><div style={{ fontSize: '10px', color: C.textMuted }}>Toplam Mesafe</div><div style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>{summary.total_distance_km.toFixed(1)} km</div></div>
                              {summary.unassigned_count > 0 && <div><div style={{ fontSize: '10px', color: C.textMuted }}>Atanamayan</div><div style={{ fontSize: '15px', fontWeight: 700, color: C.danger }}>{summary.unassigned_count}</div></div>}
                            </div>
                          </div>
                        )}

                        <div style={{ padding: '0 8px' }}>
                          {routes.map((r, ri) => {
                            const vehicle = vehicles.find(v => v.id === r.vehicle_id)
                            const depot = vehicle ? depots.find(d => d.id === vehicle.depot_id) : undefined
                            const gUrl = buildGoogleMapsUrl(r, depot, vehicle?.return_to_depot ?? true)
                            return (
                              <div key={ri} style={{ background: C.bgCard, border: `1px solid ${C.borderLight}`, borderLeft: `3px solid ${r.color}`, borderRadius: '8px', padding: '11px', marginBottom: '7px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                  <span style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>{r.vehicle_name}</span>
                                  <span style={{ fontSize: '11px', color: C.textMuted }}>{r.total_distance_km} km • {r.total_duration_min} dk*</span>
                                </div>
                                {r.stops.map((s, j) => {
                                  const mapNum = orderedStopIds.indexOf(s.id) + 1
                                  return (
                                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '5px 0', borderTop: j > 0 ? `1px solid ${C.borderLight}` : 'none' }}>
                                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: r.color, color: '#fff', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {mapNum > 0 ? mapNum : j + 1}
                                      </div>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '12px', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {s.name}{s.late && <span style={{ color: C.danger, fontSize: '10px', marginLeft: '5px' }}>⚠</span>}
                                        </div>
                                        <div style={{ fontSize: '10px', color: C.textMuted }}>🕐 {s.arrival} → {s.departure}</div>
                                      </div>
                                    </div>
                                  )
                                })}

                                {/* Navigasyon butonu */}
                                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${C.borderLight}` }}>
                                  <a href={gUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '8px', borderRadius: '7px', background: 'rgba(66,133,244,0.1)', border: '1px solid rgba(66,133,244,0.25)', color: '#4285f4', fontSize: '11px', fontWeight: 600, textDecoration: 'none' }}>
                                    Google Maps'te Aç
                                  </a>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        <div style={{ padding: '4px 8px 8px', fontSize: '10px', color: C.textDim }}>* Trafik dahil edilmeden hesaplanmıştır</div>

                        {unassigned.length > 0 && (
                          <div style={{ margin: '0 8px 8px', background: C.dangerL, border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '11px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: C.danger, marginBottom: '5px' }}>⚠ Atanamayan ({unassigned.length})</div>
                            <div style={{ fontSize: '11px', color: C.textMuted, marginBottom: '5px' }}>Kapasite veya zaman kısıtı nedeniyle atanamadı.</div>
                            {unassigned.map(s => <div key={s.id} style={{ fontSize: '11px', color: C.text, padding: '2px 0' }}>• {s.name}</div>)}
                          </div>
                        )}
                      </>
                    )}
                </div>
              )}
            </div>

            {/* MAP */}
            <div style={{ flex: 1, position: 'relative', display: isMobile && showPanel ? 'none' : 'block' }}>
              <div ref={mapRef} style={{ position: 'absolute', inset: 0 }} />
              {!isMobile && (
                <div style={{ position: 'absolute', bottom: '18px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(24,28,39,0.88)', color: '#c8d4e8', borderRadius: '20px', padding: '5px 14px', fontSize: '11px', pointerEvents: 'none', backdropFilter: 'blur(8px)', fontWeight: 500, border: '1px solid rgba(255,255,255,0.06)' }}>
                  Haritaya tıklayarak durak ekleyebilirsiniz
                </div>
              )}
              {isMobile && (
                <div style={{ position: 'absolute', bottom: '18px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(24,28,39,0.88)', color: '#c8d4e8', borderRadius: '20px', padding: '5px 14px', fontSize: '11px', pointerEvents: 'none', backdropFilter: 'blur(8px)', fontWeight: 500, border: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>
                  Haritaya tıklayarak durak ekleyebilirsiniz
                </div>
              )}
            </div>
          </div>

          {/* DEPOTS PAGE */}
          {page === 'depots' && (
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 800, color: C.text }}>Depo Yönetimi</h2>
                  <p style={{ margin: '3px 0 0', color: C.textMuted, fontSize: '13px' }}>Araçların başlangıç ve bitiş noktaları</p>
                </div>
                <button onClick={() => { setDErrors({}); setShowDepotModal(true) }} style={pBtn}><PlusIcon s={14} /> Depo Ekle</button>
              </div>
              {depots.length === 0 && (
                <InfoBox icon="🏭" title="Depo nedir?">
                  Araçların yolculuğa başladığı ve/veya bitirdiği noktadır. Firmanızın deposu, ofisi veya herhangi bir başlangıç noktası olabilir. Optimize edebilmek için en az 1 depo gereklidir.
                </InfoBox>
              )}
              {depots.length === 0
                ? <EmptyState icon="🏭" title="Depo yok" sub="İlk deponuzu ekleyin" />
                : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                    {depots.map(d => (
                      <div key={d.id} style={{ background: C.bgPanel, borderRadius: '10px', border: `1px solid ${C.border}`, padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '38px', height: '38px', borderRadius: '9px', background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '19px' }}>🏭</div>
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>{d.name}</div>
                              <div style={{ fontSize: '11px', color: C.textMuted }}>{d.address.substring(0, 48)}</div>
                            </div>
                          </div>
                          <button onClick={() => setDepots(p => p.filter(x => x.id !== d.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textDim }}><XIcon /></button>
                        </div>
                        <div style={{ fontSize: '10px', color: C.textDim }}>📍 {d.lat.toFixed(5)}, {d.lng.toFixed(5)}</div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}
        </div>
      </div>

      {/* STOP MODAL */}
      {showStopModal && pendingLoc && (
        <Modal title="Durak Ekle" sub={pendingLoc.address.substring(0, 70)} onClose={() => { setShowStopModal(false); setPendingLoc(null) }}>
          <Field label="Durak Adı"><input value={stopForm.name} onChange={e => setStopForm(f => ({ ...f, name: e.target.value }))} style={inp()} /></Field>
          <Field label="Öncelik">
            <div style={{ display: 'flex', gap: '6px' }}>
              {([1, 2, 3] as const).map(p => (
                <button key={p} onClick={() => setStopForm(f => ({ ...f, priority: p }))} style={{ flex: 1, padding: '8px', borderRadius: '7px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, border: `1.5px solid ${stopForm.priority === p ? PR[p].color : C.border}`, background: stopForm.priority === p ? PR[p].bg : C.bgCard, color: stopForm.priority === p ? PR[p].color : C.textMuted }}>
                  {PR[p].label}
                </button>
              ))}
            </div>
          </Field>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Field label="Pencere Başlangıç" flex><input type="time" value={stopForm.time_window_start} onChange={e => setStopForm(f => ({ ...f, time_window_start: e.target.value }))} style={inp()} /></Field>
            <Field label="Pencere Bitiş" flex><input type="time" value={stopForm.time_window_end} onChange={e => setStopForm(f => ({ ...f, time_window_end: e.target.value }))} style={inp()} /></Field>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Field label="Ağırlık (kg)" flex><input type="number" value={stopForm.weight_kg} onChange={e => setStopForm(f => ({ ...f, weight_kg: +e.target.value }))} style={inp()} /></Field>
            <Field label="Koli" flex><input type="number" value={stopForm.parcel_count} onChange={e => setStopForm(f => ({ ...f, parcel_count: +e.target.value }))} style={inp()} /></Field>
            <Field label="Hizmet (dk)" flex><input type="number" value={stopForm.service_duration_min} onChange={e => setStopForm(f => ({ ...f, service_duration_min: +e.target.value }))} style={inp()} /></Field>
          </div>
          <ModalActions onCancel={() => { setShowStopModal(false); setPendingLoc(null) }} onSubmit={addStop} label="Durağı Ekle" />
        </Modal>
      )}

      {/* VEHICLE MODAL */}
      {showVehicleModal && (
        <Modal title="Araç Ekle" sub="Aracın özelliklerini belirleyin" onClose={() => setShowVehicleModal(false)}>
          <Field label="Araç Adı">
            <input value={vForm.name} onChange={e => { setVForm(f => ({ ...f, name: e.target.value })); setVErrors(p => ({ ...p, name: '' })) }} placeholder="Örn: Araç 1" style={inp(vErrors.name)} />
            {vErrors.name && <span style={{ fontSize: '11px', color: C.danger }}>{vErrors.name}</span>}
          </Field>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Field label="Max Ağırlık (kg)" flex><input type="number" value={vForm.max_weight_kg} onChange={e => setVForm(f => ({ ...f, max_weight_kg: +e.target.value }))} style={inp()} /></Field>
            <Field label="Max Koli" flex><input type="number" value={vForm.max_parcels} onChange={e => setVForm(f => ({ ...f, max_parcels: +e.target.value }))} style={inp()} /></Field>
          </div>
          <Field label="Başlangıç Deposu">
            <select value={vForm.depot_id} onChange={e => { setVForm(f => ({ ...f, depot_id: e.target.value })); setVErrors(p => ({ ...p, depot: '' })) }} style={{ ...inp(vErrors.depot), cursor: 'pointer' }}>
              <option value="">— Depo seçin —</option>
              {depots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {vErrors.depot && <span style={{ fontSize: '11px', color: C.danger }}>{vErrors.depot}</span>}
          </Field>
          <Field label="Rota Sonu">
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { k: 'same', l: '🔄 Aynı Depoya Dön', active: vForm.return_to_depot },
                { k: 'open', l: '🚪 Açık Rota', active: !vForm.return_to_depot && !vForm.end_depot_id },
                ...(depots.length > 1 ? [{ k: 'other', l: '🏭 Farklı Depo', active: !vForm.return_to_depot && !!vForm.end_depot_id }] : []),
              ].map(o => (
                <button key={o.k} onClick={() => {
                  if (o.k === 'same') setVForm(f => ({ ...f, return_to_depot: true, end_depot_id: f.depot_id }))
                  else if (o.k === 'open') setVForm(f => ({ ...f, return_to_depot: false, end_depot_id: null }))
                  else setVForm(f => ({ ...f, return_to_depot: false, end_depot_id: depots.find(d => d.id !== f.depot_id)?.id || '' }))
                }} style={{ padding: '7px 11px', borderRadius: '7px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, border: `1.5px solid ${o.active ? C.accent : C.border}`, background: o.active ? C.accentL : C.bgCard, color: o.active ? C.accent : C.textMuted }}>
                  {o.l}
                </button>
              ))}
            </div>
          </Field>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Field label="Çıkış" flex><input type="time" value={vForm.start_time} onChange={e => setVForm(f => ({ ...f, start_time: e.target.value }))} style={inp()} /></Field>
            <Field label="Bitiş" flex><input type="time" value={vForm.end_time} onChange={e => setVForm(f => ({ ...f, end_time: e.target.value }))} style={inp()} /></Field>
            <Field label="Max Gün" flex><input type="number" min={1} max={7} value={vForm.max_days} onChange={e => setVForm(f => ({ ...f, max_days: +e.target.value }))} style={inp()} /></Field>
          </div>
          <ModalActions onCancel={() => setShowVehicleModal(false)} onSubmit={submitVehicle} label="Aracı Ekle" />
        </Modal>
      )}

      {/* DEPOT MODAL */}
      {showDepotModal && (
        <Modal title="Depo Ekle" sub="Araçların başlangıç/bitiş noktası" onClose={() => { setShowDepotModal(false); setDErrors({}); setDForm({ name: '', address: '', lat: 0, lng: 0 }); setDSearch('') }}>
          <Field label="Depo Adı">
            <input value={dForm.name} onChange={e => { setDForm(f => ({ ...f, name: e.target.value })); setDErrors(p => ({ ...p, name: '' })) }} placeholder="Örn: Merkez Depo" style={inp(dErrors.name)} />
            {dErrors.name && <span style={{ fontSize: '11px', color: C.danger }}>{dErrors.name}</span>}
          </Field>
          <Field label="Adres">
            <div style={{ position: 'relative' }}>
              <input value={dSearch} onChange={e => { onDChange(e.target.value); setDErrors(p => ({ ...p, address: '' })) }} placeholder="İlçe veya mahalle adı yazın..." style={inp(dErrors.address)} />
              {dForm.lat !== 0 && <div style={{ position: 'absolute', right: '10px', top: '10px', fontSize: '11px', color: C.success }}>✓</div>}
              {dResults.length > 0 && (
                <div style={{ position: 'absolute', zIndex: 200, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: '8px', boxShadow: C.shadow, width: '100%', top: '100%', marginTop: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                  {dResults.map((r, i) => (
                    <div key={i} onClick={() => { setDForm(f => ({ ...f, address: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) })); setDSearch(r.display_name); setDResults([]); setDErrors(p => ({ ...p, address: '' })) }}
                      style={{ padding: '9px 11px', cursor: 'pointer', fontSize: '12px', color: C.text, borderBottom: i < dResults.length - 1 ? `1px solid ${C.borderLight}` : 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.bgHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = C.bgCard)}>
                      🏭 {r.display_name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {dErrors.address ? <span style={{ fontSize: '11px', color: C.danger }}>{dErrors.address}</span> : <span style={{ fontSize: '10px', color: C.textDim }}>Listeden bir sonuç seçin</span>}
          </Field>
          <ModalActions onCancel={() => { setShowDepotModal(false); setDErrors({}); setDForm({ name: '', address: '', lat: 0, lng: 0 }); setDSearch('') }} onSubmit={submitDepot} label="Depoyu Ekle" />
        </Modal>
      )}
    </div>
  )
}