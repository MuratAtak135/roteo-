export type UserRole = 'admin' | 'driver'
export type VehicleType = 'car' | 'van' | 'truck' | 'semi'
export type FuelType = 'gasoline' | 'diesel' | 'electric' | 'lpg'
export type PlanStatus = 'draft' | 'optimized' | 'assigned' | 'active' | 'completed'
export type RouteStatus = 'pending' | 'active' | 'completed'
export type Priority = 1 | 2 | 3

export interface Company {
  id: string
  name: string
  slug: string
  settings: Record<string, unknown>
  created_at: string
}

export interface Profile {
  id: string
  company_id: string
  full_name: string
  role: UserRole
  phone?: string
  avatar_url?: string
  created_at: string
}

export interface Depot {
  id: string
  company_id: string
  name: string
  address: string
  lat: number
  lng: number
  open_time: string
  close_time: string
  is_default: boolean
}

export interface Vehicle {
  id: string
  company_id: string
  name: string
  plate: string
  type: VehicleType
  max_weight_kg: number
  max_volume_m3: number
  max_parcels: number
  cost_per_km: number
  fuel_type: FuelType
  is_active: boolean
}

export interface Driver {
  id: string
  company_id: string
  profile_id?: string
  name: string
  phone?: string
  license_type: string
  vehicle_id?: string
  is_active: boolean
}

export interface Customer {
  id: string
  company_id: string
  name: string
  phone?: string
  email?: string
  address: string
  lat: number
  lng: number
  notes?: string
}

export interface Stop {
  id: string
  company_id: string
  customer_id?: string
  name: string
  address: string
  lat: number
  lng: number
  weight_kg: number
  volume_m3: number
  parcel_count: number
  priority: Priority
  time_window_start?: string
  time_window_end?: string
  service_duration_min: number
  notes?: string
}

export interface RoutePlan {
  id: string
  company_id: string
  name: string
  date: string
  depot_id?: string
  status: PlanStatus
  optimization_result?: unknown
  total_distance_km?: number
  total_duration_min?: number
  total_cost?: number
  created_at: string
}