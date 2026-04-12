'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setError(null)
    setLoading(true)

    const supabase = getSupabase()
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !data.user) {
      setError('E-mailadres of wachtwoord klopt niet.')
      setLoading(false)
      return
    }

    const user = data.user
    const ADMIN_UUID = 'a596f282-c927-4a11-aaec-bb18721cac50'

    if (user.id === ADMIN_UUID) {
      router.push('/admin')
      return
    }

    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role, trainer_id')
      .eq('user_id', user.id)
      .single()

    if (!roleRow) {
      setError('Geen rol gevonden voor dit account. Neem contact op met de beheerder.')
      setLoading(false)
      return
    }

    if (roleRow.role === 'management') {
      router.push('/management')
    } else if (roleRow.role === 'trainer' && roleRow.trainer_id) {
      router.push(`/trainer/${roleRow.trainer_id}`)
    } else {
      router.push('/')
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap');

        .login-root {
          min-height: 100vh;
          background: var(--bg-base);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-primary);
          padding: 40px 24px;
        }

        .login-root::before {
          content: '';
          position: fixed;
          top: -20%;
          left: -10%;
          width: 60%;
          height: 60%;
          background: radial-gradient(ellipse, rgba(168,200,0,0.07) 0%, transparent 70%);
          pointer-events: none;
        }

        .login-card {
          width: 100%;
          max-width: 400px;
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .login-wordmark {
          text-align: center;
        }
        .login-wordmark-wav { font-size: 2rem; font-weight: 700; letter-spacing: -0.02em; color: var(--wave-gray); }
        .login-wordmark-e   { font-size: 2rem; font-weight: 700; letter-spacing: -0.02em; color: var(--wave-green); }
        .login-wordmark-sub {
          display: block;
          font-size: 0.62rem;
          font-weight: 500;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: var(--border-strong);
          margin-top: 0.2rem;
        }

        .login-form {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 28px 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }

        .login-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .login-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .login-input {
          background: var(--bg-base);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          padding: 10px 14px;
          color: var(--text-primary);
          font-family: var(--font-primary);
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .login-input:focus {
          border-color: var(--wave-green);
          box-shadow: 0 0 0 3px rgba(168,200,0,0.1);
        }

        .login-error {
          font-size: 12px;
          color: #f87171;
          background: rgba(248,113,113,0.08);
          border: 1px solid rgba(248,113,113,0.2);
          border-radius: 6px;
          padding: 10px 12px;
        }

        .login-button {
          background: var(--wave-green);
          color: #000;
          border: none;
          border-radius: 8px;
          padding: 12px;
          font-family: var(--font-primary);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: opacity 0.2s ease;
        }

        .login-button:hover:not(:disabled) { opacity: 0.88; }
        .login-button:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <main className="login-root">
        <div className="login-card">
          <div className="login-wordmark">
            <div>
              <span className="login-wordmark-wav">wav-e</span>
              <span className="login-wordmark-e"> studios</span>
            </div>
            <span className="login-wordmark-sub">EMS coaching intelligence</span>
          </div>

          <div className="login-form">
            <div className="login-field">
              <label className="login-label">E-mailadres</label>
              <input
                className="login-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="naam@wav-e.nl"
                autoComplete="email"
                autoFocus
              />
            </div>

            <div className="login-field">
              <label className="login-label">Wachtwoord</label>
              <input
                className="login-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && <div className="login-error">{error}</div>}

            <button
              className="login-button"
              onClick={handleLogin}
              disabled={loading || !email || !password}
            >
              {loading ? 'Inloggen…' : 'Inloggen →'}
            </button>
          </div>
        </div>
      </main>
    </>
  )
}
