import { useState } from 'react'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'

export type Lang = 'en' | 'tr'

export default function App() {
  const [showLanding, setShowLanding] = useState(true)
  const [lang, setLang] = useState<Lang>('en')

  if (showLanding) return <Landing onStart={() => setShowLanding(false)} lang={lang} setLang={setLang} />
  return <Dashboard lang={lang} />
}