import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage({ onSwitch }: { onSwitch: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>R</div>
          <h1 style={styles.logoText}>Roteo</h1>
        </div>
        <p style={styles.subtitle}>Rota Optimizasyon Platformu</p>

        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>E-posta</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={styles.input}
              placeholder="ornek@sirket.com"
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Şifre</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={styles.input}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>

        <p style={styles.switchText}>
          Hesabın yok mu?{' '}
          <span onClick={onSwitch} style={styles.switchLink}>
            Kayıt ol
          </span>
        </p>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%)',
    padding: '16px',
  },
  card: {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '40px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  },
  logo: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' },
  logoIcon: {
    width: '40px', height: '40px', borderRadius: '10px',
    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    color: '#fff', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontWeight: 'bold', fontSize: '20px',
  },
  logoText: { fontSize: '24px', fontWeight: '700', color: '#0f172a', margin: 0 },
  subtitle: { color: '#64748b', fontSize: '14px', marginBottom: '32px', marginTop: '4px' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '14px', fontWeight: '500', color: '#374151' },
  input: {
    padding: '10px 14px', borderRadius: '8px',
    border: '1.5px solid #e2e8f0', fontSize: '14px',
    outline: 'none', transition: 'border-color 0.2s',
    color: '#0f172a',
  },
  error: {
    background: '#fef2f2', border: '1px solid #fecaca',
    color: '#dc2626', borderRadius: '8px',
    padding: '10px 14px', fontSize: '13px',
  },
  button: {
    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    color: '#fff', border: 'none', borderRadius: '8px',
    padding: '12px', fontSize: '15px', fontWeight: '600',
    cursor: 'pointer', marginTop: '8px',
  },
  switchText: { textAlign: 'center', color: '#64748b', fontSize: '14px', marginTop: '24px' },
  switchLink: { color: '#3b82f6', cursor: 'pointer', fontWeight: '600' },
}