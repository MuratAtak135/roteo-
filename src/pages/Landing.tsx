export default function Landing({ onStart, lang, setLang }: { onStart: () => void, lang: 'en' | 'tr', setLang: (l: 'en' | 'tr') => void }) {
  const T = lang === 'tr' ? {
    badge: 'VROOM Tabanlı Rota Optimizasyonu',
    title1: 'Rotalarınızı ',
    titleGradient: 'saniyeler içinde',
    title2: ' optimize edin',
    desc: 'Çoklu araç, süre ve kapasite kısıtlarını dikkate alarak dağıtım rotasını optimize eder.',
    btn: 'Ücretsiz Dene',
    s1: 'Durak / İstek', s2: 'Araç Desteği', s3: 'Çok Günlü Rota',
    steps: [
      { n: '01', t: 'Depo & Araç Ekle', d: 'Başlangıç noktanızı ve araçlarınızı tanımlayın.' },
      { n: '02', t: 'Durakları Girin', d: 'Teslimat noktaları ekleyin.' },
      { n: '03', t: 'Optimize Edin', d: 'VROOM ile rotayı optimize edin.' },
    ],
    stepLabel: 'ADIM',
    footer: '© 2025 Atak Route — Powered by VROOM & OpenStreetMap'
  } : {
    badge: 'VROOM Based Route Optimization',
    title1: 'Optimize your routes in ',
    titleGradient: 'seconds',
    title2: '',
    desc: 'Optimizes distribution routes considering multi-vehicle, time, and capacity constraints.',
    btn: 'Try for Free',
    s1: 'Stops / Requests', s2: 'Vehicle Support', s3: 'Multi-Day Route',
    steps: [
      { n: '01', t: 'Add Depot & Vehicle', d: 'Define your starting point and vehicles.' },
      { n: '02', t: 'Enter Stops', d: 'Add delivery points.' },
      { n: '03', t: 'Optimize', d: 'Optimize the route with VROOM.' },
    ],
    stepLabel: 'STEP',
    footer: '© 2025 Atak Route — Powered by VROOM & OpenStreetMap'
  }

  return (
    <div style={{
      height: '100vh', overflow: 'hidden',
      background: '#111318',
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
      display: 'flex', flexDirection: 'column', color: '#e2e8f0',
      position: 'relative'
    }}>
      <div style={{ position: 'absolute', top: 20, right: 24, zIndex: 10 }}>
        <select value={lang} onChange={e => setLang(e.target.value as 'en' | 'tr')}
          style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', outline: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
          <option value="en">English</option>
          <option value="tr">Türkçe</option>
        </select>
      </div>

      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 24px', textAlign: 'center',
      }}>
        <img src="/logo.png" alt="Atak Route"
          style={{ height: 'clamp(64px, 12vw, 110px)', objectFit: 'contain', marginBottom: '28px' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: '20px', padding: '5px 14px',
          fontSize: '12px', fontWeight: 600, color: '#60a5fa', marginBottom: '20px',
        }}>
            {T.badge}
        </div>

        <h1 style={{
          fontSize: 'clamp(26px, 5vw, 60px)', fontWeight: 800, color: '#f8fafc',
          margin: '0 0 14px', lineHeight: 1.08, letterSpacing: '-0.03em', maxWidth: '680px',
        }}>
          {T.title1}
          <span style={{ background: 'linear-gradient(135deg, #3b82f6, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {T.titleGradient}
          </span>
          {T.title2}
        </h1>

        <p style={{ fontSize: 'clamp(14px, 2vw, 16px)', color: '#94a3b8', maxWidth: '440px', lineHeight: 1.65, margin: '0 0 32px' }}>
          {T.desc}
        </p>

        <button onClick={onStart} style={{
          background: '#2563eb', color: '#fff', border: 'none',
          borderRadius: '10px', padding: 'clamp(12px, 2vw, 14px) clamp(28px, 5vw, 40px)',
          fontSize: 'clamp(14px, 2vw, 16px)', fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 4px 24px rgba(37,99,235,0.4)',
        }}>
          {T.btn}
        </button>

        <div style={{ display: 'flex', gap: 'clamp(24px, 5vw, 48px)', marginTop: '40px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {[{ v: '1.000+', l: T.s1 }, { v: '100+', l: T.s2 }, { v: '7', l: T.s3 }].map(s => (
            <div key={s.v} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(18px, 3vw, 24px)', fontWeight: 800, color: '#f8fafc' }}>{s.v}</div>
              <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px', fontWeight: 500 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </main>

      <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          {T.steps.map(f => (
            <div key={f.n} style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#3b82f6', letterSpacing: '0.08em', marginBottom: '3px' }}>{T.stepLabel} {f.n}</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#f1f5f9', marginBottom: '2px' }}>{f.t}</div>
              <div style={{ fontSize: '11px', color: '#475569', lineHeight: 1.5 }}>{f.d}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: '8px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <p style={{ color: '#1e2a3a', fontSize: '10px', margin: 0 }}>{T.footer}</p>
      </div>
    </div>
  )
}