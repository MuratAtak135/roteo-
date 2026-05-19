import { useState } from 'react'
import Landing from '@/pages/Landing'
import Dashboard from '@/pages/Dashboard'

export default function App() {
  const [showLanding, setShowLanding] = useState(true)
  if (showLanding) return <Landing onStart={() => setShowLanding(false)} />
  return <Dashboard />
}