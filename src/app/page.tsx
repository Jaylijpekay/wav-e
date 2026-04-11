'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'

type Trainer = {
  id: string
  naam: string
}

export default function Home() {
  const router = useRouter()
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [selectedTrainer, setSelectedTrainer] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabase()
      const { data } = await supabase
        .from('trainers')
        .select('id, naam')
        .order('naam')
      setTrainers(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const handleTrainerSelect = (id: string) => {
    setSelectedTrainer(id)
    if (id) router.push(`/trainer/${id}`)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap');

        .home-root {
          min-height: 100vh;
          background: #111;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Raleway', sans-serif;
          padding: 40px 24px;
          position: relative;
          overflow: hidden;
        }

        /* Ambient glow */
        .home-root::before {
          content: '';
          position: fixed;
          top: -20%;
          left: -10%;
          width: 60%;
          height: 60%;
          background: radial-gradient(ellipse, rgba(168,200,0,0.07) 0%, transparent 70%);
          pointer-events: none;
        }
        .home-root::after {
          content: '';
          position: fixed;
          bottom: -20%;
          right: -10%;
          width: 50%;
          height: 50%;
          background: radial-gradient(ellipse, rgba(168,200,0,0.05) 0%, transparent 70%);
          pointer-events: none;
        }

        /* Wordmark */
        .wordmark {
          text-align: center;
          animation: fadeUp 0.5s ease-out both;
        }
        .wordmark-wav {
          font-size: 2.25rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #5A5A5A;
        }
        .wordmark-e {
          font-size: 2.25rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #A8C800;
        }
        .wordmark-studios {
          display: block;
          font-size: 0.65rem;
          font-weight: 500;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: #3a3a3a;
          margin-top: 0.2rem;
        }

        /* Grid */
        .nav-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1px;
          width: 100%;
          max-width: 520px;
          background: #1f1f1f;
          border: 1px solid #1f1f1f;
          border-radius: 4px;
          overflow: hidden;
          box-shadow:
            0 0 0 1px rgba(168,200,0,0.08),
            0 8px 32px rgba(0,0,0,0.4),
            0 2px 8px rgba(0,0,0,0.3);
          animation: fadeUp 0.5s ease-out 0.1s both;
        }

        /* Cards */
        .nav-card {
          background: #141414;
          padding: 28px 24px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          cursor: pointer;
          transition: background 0.2s ease, box-shadow 0.2s ease;
          position: relative;
          overflow: hidden;
        }

        .nav-card::before {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: #A8C800;
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.25s ease;
        }

        .nav-card:hover {
          background: #181818;
        }

        .nav-card:hover::before {
          transform: scaleX(1);
        }

        .nav-card:hover .card-arrow {
          color: #A8C800;
          transform: translateX(3px);
        }

        .nav-card:hover .card-label {
          color: #fff;
        }

        .card-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: #c8c6c0;
          letter-spacing: 0.03em;
          transition: color 0.2s ease;
        }

        .card-desc {
          font-size: 0.72rem;
          color: #3a3a3a;
          letter-spacing: 0.04em;
          font-weight: 400;
        }

        .card-arrow {
          font-size: 1rem;
          color: #2a2a2a;
          margin-top: 14px;
          transition: color 0.2s ease, transform 0.2s ease;
          display: inline-block;
        }

        /* Trainer select card */
        .trainer-select {
          margin-top: 14px;
          background: #0d0d0d;
          border: 1px solid #2a2a2a;
          color: #c8c6c0;
          font-family: 'Raleway', sans-serif;
          font-size: 0.8rem;
          font-weight: 500;
          padding: 10px 12px;
          border-radius: 3px;
          width: 100%;
          cursor: pointer;
          appearance: none;
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .trainer-select:focus {
          border-color: #A8C800;
          box-shadow: 0 0 0 3px rgba(168,200,0,0.1);
        }

        .trainer-select option {
          background: #141414;
          color: #c8c6c0;
        }

        /* Eindhoven tag */
        .location-tag {
          font-size: 0.62rem;
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #2a2a2a;
          animation: fadeUp 0.5s ease-out 0.2s both;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Float animation for the grid as a whole */
        @keyframes floatGrid {
          0%, 100% { transform: translateY(0px);  box-shadow: 0 0 0 1px rgba(168,200,0,0.08), 0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3); }
          50%       { transform: translateY(-5px); box-shadow: 0 0 0 1px rgba(168,200,0,0.13), 0 16px 48px rgba(0,0,0,0.45), 0 4px 16px rgba(0,0,0,0.25); }
        }

        .nav-grid {
          animation: fadeUp 0.5s ease-out 0.1s both, floatGrid 6s ease-in-out 0.6s infinite;
        }
      `}</style>

      <main className="home-root">
        <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40, position: 'relative', zIndex: 1 }}>

          {/* Wordmark */}
          <div className="wordmark">
            <div>
              <span className="wordmark-wav">wav-e</span>
              <span className="wordmark-e"> studios</span>
            </div>
            <span className="wordmark-studios">EMS coaching intelligence</span>
          </div>

          {/* 2×2 nav grid */}
          <div className="nav-grid">

            {/* Personal trainer */}
            <div className="nav-card">
              <div className="card-label">Personal trainer</div>
              <div className="card-desc">Open jouw dashboard</div>
              <select
                className="trainer-select"
                value={selectedTrainer}
                onChange={e => handleTrainerSelect(e.target.value)}
                disabled={loading}
              >
                <option value="">
                  {loading ? 'Laden…' : 'Selecteer trainer →'}
                </option>
                {trainers.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.naam}
                  </option>
                ))}
              </select>
            </div>

            {/* Management */}
            <div
              className="nav-card"
              onClick={() => router.push('/management')}
            >
              <div className="card-label">Management</div>
              <div className="card-desc">Studio-breed overzicht</div>
              <span className="card-arrow">→</span>
            </div>

            {/* Nieuw lid */}
            <div
              className="nav-card"
              onClick={() => router.push('/nieuw-lid')}
            >
              <div className="card-label">Nieuw lid</div>
              <div className="card-desc">Lid toevoegen</div>
              <span className="card-arrow">→</span>
            </div>

            {/* Admin */}
            <div
              className="nav-card"
              onClick={() => router.push('/admin')}
            >
              <div className="card-label">Admin</div>
              <div className="card-desc">Instellingen & beheer</div>
              <span className="card-arrow">→</span>
            </div>

          </div>

          {/* Location */}
          <div className="location-tag">Eindhoven</div>

        </div>
      </main>
    </>
  )
}
