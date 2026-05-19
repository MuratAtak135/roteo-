import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function RegisterPage({ onSwitch }: { onSwitch: () => void }) {
  const [form, setForm] = useState({ fullName: '', companyName: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function set(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const slug = form.companyName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName,
          company_name: form.companyName,
          company_slug: slug,
        },
      },
    })

    if (error) setError(error.message)
    else setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✉️</div>
            <h2 style={{ color: '#0f172a', marginBottom: '8px' }}>E-postanı kontrol et</h2>
            <p style={{ color: '#64748b', fontSize: '14px' }}>
              {form.email} adresine doğrulama linki gönderdik.
            </p>
            <span onClick={onSwitch} style={{ ...styles.switchLink, display: 'block', marginTop: '24px' }}>
              Giriş sayfasına dön
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>R</div>
          <h1 style={styles.logoText}>Roteo</h1>
        </div>
        <p style={styles.subtitle}>Ücretsiz hesap oluştur</p>

        <form onSubmit={handleRegister} style={styles.form}>
          {[
            { key: 'fullName', label: 'Ad Soyad', type: 'text', placeholder: 'Ahmet Yılmaz' },
            { key: 'companyName', label: 'Şirket Adı', type: 'text', placeholder: 'Yılmaz Lojistik' },
            { key: 'email', label: 'E-posta', type: 'email', placeholder: 'ornek@sirket.com' },
            { key: 'password', label: 'Şifre', type: 'password', placeholder: '••••••••' },
          ].map(f => (
            <div key={f.key} style={styles.field}>
              <label style={styles.label}>{f.label}</label>
              <input
                type={f.type}
                value={form[f.key as keyof typeof form]}
                onChange={e => set(f.key, e.target.value)}
                style={styles.input}
                placeholder={f.placeholder}
                required
                minLength={f.key === 'password' ? 6 : undefined}
              />
            </div>
          ))}

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Hesap oluşturuluyor...' : 'Hesap Oluştur'}
          </button>
        </form>

        <p style={styles.switchText}>
          Hesabın var mı?{' '}
          <span onClick={onSwitch} style={styles.switchLink}>Giriş yap</span>
        </p>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%)',
    padding: '16px',
  },
  card: {
    background: '#ffffff', borderRadius: '16px', padding: '40px',
    width: '100%', maxWidth: '420px',
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
    outline: 'none', color: '#0f172a',
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