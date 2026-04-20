'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Person = {
  id: string
  naam: string
  voornaam: string
  has_pin: boolean
}

type Mode = 'trainer' | 'management'
type Step = 'loading' | 'invalid' | 'mode-select' | 'picker' | 'pin' | 'authed'

export default function ConsolePage() {
  const router = useRouter()

  const [step,       setStep]       = useState<Step>('loading')
  const [mode,       setMode]       = useState<Mode | null>(null)
  const [trainers,   setTrainers]   = useState<Person[]>([])
  const [management, setManagement] = useState<Person[]>([])
  const [selected,   setSelected]   = useState<Person | null>(null)
  const [pin,        setPin]        = useState('')
  const [pinError,   setPinError]   = useState<string | null>(null)
  const [verifying,  setVerifying]  = useState(false)

  // Validate token on mount
  useEffect(() => {
    const validate = async () => {
      const params = new URLSearchParams(window.location.search)
      const token = params.get('token') ?? document.cookie.match(/console_token=([^;]+)/)?.[1]
      if (!token) { setStep('invalid'); return }

      const res = await fetch(`/api/console/validate?token=${token}`)
      if (!res.ok) { setStep('invalid'); return }

      // Load people
      const peopleRes = await fetch('/api/console/people')
      if (!peopleRes.ok) { setStep('invalid'); return }
      const data = await peopleRes.json()
      setTrainers(data.trainers ?? [])
      setManagement(data.management ?? [])
      setStep('mode-select')
    }
    validate()
  }, [])

  const selectMode = (m: Mode) => {
    setMode(m)
    setStep('picker')
  }

  const selectPerson = (person: Person) => {
    if (!person.has_pin) return // no PIN set, can't log in
    setSelected(person)
    setPin('')
    setPinError(null)
    setStep('pin')
  }

  const tapDigit = (digit: string) => {
    if (pin.length >= 4) return
    setPin(p => p + digit)
  }

  const tapDelete = () => setPin(p => p.slice(0, -1))

  const verify = async () => {
    if (pin.length !== 4 || !selected || !mode) return
    setVerifying(true)
    setPinError(null)

    const res = await fetch('/api/console/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: mode, id: selected.id, pin }),
    })

    setVerifying(false)

    if (!res.ok) {
      setPinError('Onjuiste PIN. Probeer opnieuw.')
      setPin('')
      return
    }

    setStep('authed')
    if (mode === 'trainer') {
      router.push(`/trainer/${selected.id}`)
    } else {
      router.push('/management')
    }
  }

  // Auto-verify when 4 digits entered
  useEffect(() => {
    if (pin.length === 4 && step === 'pin') verify()
  }, [pin])

  const people = mode === 'trainer' ? trainers : management

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700;800&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .con-root {
          min-height: 100vh;
          background: #111;
          color: #c8c6c0;
          font-family: 'Raleway', sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px 24px;
          position: relative;
          overflow: hidden;
        }

        .con-root::before {
          content: '';
          position: fixed;
          top: -20%;
          right: -10%;
          width: 60%;
          height: 60%;
          background: radial-gradient(ellipse, rgba(168,200,0,0.05) 0%, transparent 70%);
          pointer-events: none;
        }

        .con-wordmark {
          position: absolute;
          top: 28px;
          left: 32px;
          display: flex;
          align-items: baseline;
        }
        .con-wordmark-wav { font-size: 1rem; font-weight: 700; color: #3a3a3a; }
        .con-wordmark-e   { font-size: 1rem; font-weight: 700; color: #A8C800; }

        .con-back {
          position: absolute;
          top: 24px;
          right: 32px;
          background: none;
          border: 1px solid #2a2a2a;
          border-radius: 3px;
          color: #3a3a3a;
          font-family: 'Raleway', sans-serif;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 7px 14px;
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s;
        }
        .con-back:hover { border-color: #3a3a3a; color: #666; }

        .con-card {
          width: 100%;
          max-width: 520px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 32px;
        }

        .con-title {
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #3a3a3a;
          text-align: center;
        }

        /* Mode select */
        .con-mode-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          width: 100%;
        }

        .con-mode-btn {
          background: #141414;
          border: 1px solid #1e1e1e;
          border-radius: 3px;
          padding: 32px 24px;
          cursor: pointer;
          font-family: 'Raleway', sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          transition: border-color 0.2s, background 0.2s, transform 0.2s;
        }
        .con-mode-btn:hover {
          border-color: rgba(168,200,0,0.3);
          background: rgba(168,200,0,0.04);
          transform: translateY(-2px);
        }
        .con-mode-icon {
          font-size: 2rem;
          line-height: 1;
        }
        .con-mode-label {
          font-size: 0.9rem;
          font-weight: 700;
          color: #c8c6c0;
          letter-spacing: 0.04em;
        }
        .con-mode-sub {
          font-size: 0.68rem;
          color: #3a3a3a;
          letter-spacing: 0.06em;
          text-align: center;
          line-height: 1.5;
        }

        /* Picker */
        .con-picker-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 10px;
          width: 100%;
        }

        .con-person-btn {
          background: #141414;
          border: 1px solid #1e1e1e;
          border-radius: 3px;
          padding: 20px 16px;
          cursor: pointer;
          font-family: 'Raleway', sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          transition: border-color 0.15s, background 0.15s, transform 0.15s;
          position: relative;
        }
        .con-person-btn.has-pin:hover {
          border-color: rgba(168,200,0,0.3);
          background: rgba(168,200,0,0.04);
          transform: translateY(-2px);
        }
        .con-person-btn.no-pin {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .con-person-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #1e1e1e;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1rem;
          font-weight: 700;
          color: #A8C800;
          letter-spacing: 0;
        }

        .con-person-name {
          font-size: 0.8rem;
          font-weight: 600;
          color: #c8c6c0;
          text-align: center;
          line-height: 1.3;
        }

        .con-no-pin-tag {
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #2a2a2a;
        }

        /* PIN entry */
        .con-pin-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .con-pin-name {
          font-size: 1.1rem;
          font-weight: 700;
          color: #c8c6c0;
        }

        .con-pin-dots {
          display: flex;
          gap: 16px;
          margin: 8px 0;
        }

        .con-pin-dot {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2px solid #2a2a2a;
          transition: background 0.15s, border-color 0.15s;
        }
        .con-pin-dot.filled {
          background: #A8C800;
          border-color: #A8C800;
        }

        .con-pin-error {
          font-size: 0.75rem;
          color: #f87171;
          letter-spacing: 0.04em;
          height: 18px;
          text-align: center;
        }

        .con-keypad {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          width: 100%;
          max-width: 280px;
        }

        .con-key {
          background: #141414;
          border: 1px solid #1e1e1e;
          border-radius: 3px;
          padding: 18px 0;
          font-family: 'Raleway', sans-serif;
          font-size: 1.3rem;
          font-weight: 600;
          color: #c8c6c0;
          cursor: pointer;
          text-align: center;
          transition: background 0.1s, border-color 0.1s, transform 0.1s;
          user-select: none;
        }
        .con-key:active {
          background: #1a1a1a;
          border-color: rgba(168,200,0,0.3);
          transform: scale(0.96);
        }
        .con-key.delete {
          font-size: 1rem;
          color: #555;
        }
        .con-key.empty {
          background: transparent;
          border-color: transparent;
          cursor: default;
        }

        /* Invalid */
        .con-invalid {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          color: #3a3a3a;
          text-align: center;
        }
        .con-invalid-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #dc2626;
        }
        .con-invalid-text {
          font-size: 0.85rem;
          letter-spacing: 0.05em;
        }
      `}</style>

      <div className="con-root">
        <div className="con-wordmark">
          <span className="con-wordmark-wav">wav-e</span>
          <span className="con-wordmark-e"> studios</span>
        </div>

        {step !== 'loading' && step !== 'invalid' && step !== 'mode-select' && (
          <button
            className="con-back"
            onClick={() => {
              if (step === 'pin') { setStep('picker'); setPin(''); setPinError(null) }
              else if (step === 'picker') { setStep('mode-select'); setMode(null) }
            }}
          >
            ← Terug
          </button>
        )}

        {step === 'loading' && (
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#A8C800', boxShadow: '0 0 12px rgba(168,200,0,0.5)' }} />
        )}

        {step === 'invalid' && (
          <div className="con-invalid">
            <div className="con-invalid-dot" />
            <div className="con-invalid-text">Ongeldige of verlopen consoletoegang.</div>
          </div>
        )}

        {step === 'mode-select' && (
          <div className="con-card">
            <div className="con-title">Inloggen als</div>
            <div className="con-mode-grid">
              <button className="con-mode-btn" onClick={() => selectMode('trainer')}>
                <span className="con-mode-icon">🏋️</span>
                <span className="con-mode-label">Trainer</span>
                <span className="con-mode-sub">Eigen leden en acties</span>
              </button>
              <button className="con-mode-btn" onClick={() => selectMode('management')}>
                <span className="con-mode-icon">📋</span>
                <span className="con-mode-label">Management</span>
                <span className="con-mode-sub">Alle leden · studio-overzicht</span>
              </button>
            </div>
          </div>
        )}

        {step === 'picker' && (
          <div className="con-card">
            <div className="con-title">
              {mode === 'trainer' ? 'Selecteer trainer' : 'Selecteer account'}
            </div>
            <div className="con-picker-grid">
              {people.map(p => (
                <button
                  key={p.id}
                  className={`con-person-btn ${p.has_pin ? 'has-pin' : 'no-pin'}`}
                  onClick={() => selectPerson(p)}
                >
                  <div className="con-person-avatar">
                    {p.voornaam.charAt(0).toUpperCase()}
                  </div>
                  <div className="con-person-name">{p.naam}</div>
                  {!p.has_pin && <div className="con-no-pin-tag">Geen PIN</div>}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'pin' && selected && (
          <div className="con-card">
            <div className="con-pin-header">
              <div className="con-title">PIN invoeren</div>
              <div className="con-pin-name">{selected.naam}</div>
            </div>

            <div className="con-pin-dots">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`con-pin-dot ${i < pin.length ? 'filled' : ''}`} />
              ))}
            </div>

            <div className="con-pin-error">{pinError ?? ''}</div>

            <div className="con-keypad">
              {['1','2','3','4','5','6','7','8','9'].map(d => (
                <button key={d} className="con-key" onClick={() => tapDigit(d)} disabled={verifying}>{d}</button>
              ))}
              <button className="con-key empty" disabled />
              <button className="con-key" onClick={() => tapDigit('0')} disabled={verifying}>0</button>
              <button className="con-key delete" onClick={tapDelete} disabled={verifying}>⌫</button>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
