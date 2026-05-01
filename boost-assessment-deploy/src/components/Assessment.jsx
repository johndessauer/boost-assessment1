import React, { useState } from 'react'
import { Header, ProgressBar, styles, colors } from '../styles.jsx'
import { personalityRows, skillSections, contextQuestions } from '../config.js'

const PARTS = { P1: 'personality', P2: 'skills', P3: 'context' }

export default function Assessment({ contact, paymentIntent, onSubmit }) {
  const [part, setPart] = useState(PARTS.P1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [rankings, setRankings] = useState(
    personalityRows.map(() => ({ A: '', B: '', C: '', D: '' }))
  )

  const [ratings, setRatings] = useState(
    Object.fromEntries(skillSections.map(s => [s.id, ['', '', '', '']]))
  )

  const [context, setContext] = useState(
    Object.fromEntries(contextQuestions.map(q => [q.id, '']))
  )

  const validateP1 = () => {
    for (let i = 0; i < rankings.length; i++) {
      const vals = Object.values(rankings[i])
      if (vals.some(v => v === '')) return false
      const sorted = [...vals].map(Number).sort()
      if (JSON.stringify(sorted) !== '[1,2,3,4]') return false
    }
    return true
  }

  const validateP2 = () => {
    return skillSections.every(s =>
      ratings[s.id].every(v => v !== '' && Number(v) >= 1 && Number(v) <= 5)
    )
  }

  const validateP3 = () => {
    const required = ['industry', 'role', 'experience', 'challenge', 'goal']
    return required.every(id => context[id] !== '')
  }

  const setRank = (rowIndex, col, val) => {
    setRankings(prev => {
      const next = prev.map((r, i) => i === rowIndex ? { ...r, [col]: val } : r)
      return next
    })
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    
    try {
      const res = await fetch('/.netlify/functions/submit-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact, paymentIntent, rankings, ratings, context }),
      })
      
      setError('')
      setSubmitting(false)
      setTimeout(() => onSubmit(), 500)
      
    } catch (err) {
      console.error('Submission error:', err)
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  const totalParts = 3
  const partIndex = part === PARTS.P1 ? 1 : part === PARTS.P2 ? 2 : 3

  return (
    <div style={styles.page}>
      <Header />
      <div style={{ ...styles.cardWide, marginTop: 0 }}>
        <div style={{ marginBottom: 8, fontSize: 14, color: colors.midGray, fontWeight: 600 }}>
          Welcome, {contact?.fullName?.split(' ')[0]}!
        </div>
        <ProgressBar step={partIndex} total={totalParts} label={
          part === PARTS.P1 ? 'Part 1 of 3 — Personality Assessment' :
          part === PARTS.P2 ? 'Part 2 of 3 — Sales Skill Assessment' :
          'Part 3 of 3 — Context Questions'
        } />

        {part === PARTS.P1 && (
          <Part1
            rankings={rankings}
            setRank={setRank}
            onNext={() => {
              if (!validateP1()) { setError('Please complete all rows. Each row must use 1, 2, 3, and 4 exactly once.'); return }
              setError(''); setPart(PARTS.P2)
            }}
            error={error}
          />
        )}

        {part === PARTS.P2 && (
          <Part2
            ratings={ratings}
            setRatings={setRatings}
            onBack={() => { setError(''); setPart(PARTS.P1) }}
            onNext={() => {
              if (!validateP2()) { setError('Please rate every statement before continuing.'); return }
              setError(''); setPart(PARTS.P3)
            }}
            error={error}
          />
        )}

        {part === PARTS.P3 && (
          <Part3
            context={context}
            setContext={setContext}
            onBack={() => { setError(''); setPart(PARTS.P2) }}
            onSubmit={() => {
              if (!validateP3()) { setError('Please answer all required questions.'); return }
              setError(''); handleSubmit()
            }}
            submitting={submitting}
            error={error}
          />
        )}
      </div>
    </div>
  )
}

function Part1({ rankings, setRank, onNext, error }) {
  const cols = ['A', 'B', 'C', 'D']
  const colColors = { A: '#6B3FA0', B: '#C8922A', C: '#1A6FB5', D: '#C0392B' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 4, height: 44, background: colors.red, borderRadius: 2 }} />
        <div>
          <h2 style={styles.h2}>Part 1 — Personality Assessment</h2>
          <p style={{ fontSize: 14, color: colors.darkGray }}>Rank each row 1–4. <strong>1 = Most like me, 4 = Least like me.</strong> Use each number exactly once per row.</p>
        </div>
      </div>

      <div style={{ background: colors.lightGray, borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: colors.darkGray }}>
        Answer honestly — based on how you <em>actually</em> behave, not how you wish you did. Your full profile will be revealed in your report.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
        <div />
        {cols.map(c => (
          <div key={c} style={{ background: colColors[c], borderRadius: 6, padding: '8px 4px', textAlign: 'center' }}>
            <span style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>Column {c}</span>
          </div>
        ))}
      </div>

      {personalityRows.map((row, ri) => (
        <div key={ri} style={{
          display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr 1fr', gap: 6, marginBottom: 6,
          background: ri % 2 === 0 ? colors.white : colors.lightGray, borderRadius: 8, padding: '4px 0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, color: colors.red }}>
            {ri + 1}
          </div>
          {cols.map(col => (
            <div key={col} style={{ padding: '8px 6px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.black, marginBottom: 6, minHeight: 36, lineHeight: 1.4 }}>
                {row[col].split('\n').map((w, i) => <div key={i}>{w}</div>)}
              </div>
              <select
                value={rankings[ri][col]}
                onChange={e => setRank(ri, col, e.target.value)}
                style={{
                  width: '100%', padding: '7px 8px', border: `1.5px solid ${rankings[ri][col] ? colColors[col] : colors.border}`,
                  borderRadius: 6, fontSize: 14, fontWeight: 600, color: rankings[ri][col] ? colColors[col] : colors.midGray,
                  background: colors.white, cursor: 'pointer', outline: 'none',
                }}
              >
                <option value="">RANK</option>
                <option value="1">1 — Most like me</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4 — Least like me</option>
              </select>
            </div>
          ))}
        </div>
      ))}

      {error && <div style={{ color: colors.red, fontSize: 14, marginTop: 12, padding: '10px 14px', background: '#FFF0F0', borderRadius: 6 }}>{error}</div>}

      <div style={{ marginTop: 24 }}>
        <button onClick={onNext} style={styles.btnPrimary}>
          Continue to Part 2 — Sales Skills  →
        </button>
      </div>
    </div>
  )
}

function Part2({ ratings, setRatings, onBack, onNext, error }) {
  const scaleLabels = ['', 'Never', 'Rarely', 'Sometimes', 'Usually', 'Always']
  const scaleColors = ['', colors.red, '#BB3333', '#888888', '#555555', colors.black]

  const setRating = (sectionId, qIndex, val) => {
    setRatings(prev => {
      const next = { ...prev }
      next[sectionId] = [...prev[sectionId]]
      next[sectionId][qInde
