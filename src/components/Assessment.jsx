import React, { useState } from 'react'
import { Header, ProgressBar, styles, colors } from '../styles.jsx'
import { personalityRows, skillSections, contextQuestions } from '../config.js'

const PARTS = { P1: 'personality', P2: 'skills', P3: 'context' }

export default function Assessment({ contact, paymentIntent, onSubmit }) {
  const [part, setPart] = useState(PARTS.P1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Part 1: rankings[rowIndex] = { A, B, C, D } each 1-4
  const [rankings, setRankings] = useState(
    personalityRows.map(() => ({ A: '', B: '', C: '', D: '' }))
  )

  // Part 2: ratings[sectionId] = [q1, q2, q3, q4] each 1-5
  const [ratings, setRatings] = useState(
    Object.fromEntries(skillSections.map(s => [s.id, ['', '', '', '']]))
  )

  // Part 3: context answers
  const [context, setContext] = useState(
    Object.fromEntries(contextQuestions.map(q => [q.id, '']))
  )

  // ── Validation ──────────────────────────────────────────────────────────────
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

  // ── Ranking input handler ────────────────────────────────────────────────────
  const setRank = (rowIndex, col, val) => {
    setRankings(prev => {
      const next = prev.map((r, i) => i === rowIndex ? { ...r, [col]: val } : r)
      return next
    })
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/submit-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact, paymentIntent, rankings, ratings, context }),
      })
      const data = await res.json()
      if (!data.ok) { setError(data.error || 'Submission failed. Please try again.'); setSubmitting(false); return }
      onSubmit()
    } catch {
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

// ─── PART 1: PERSONALITY RANKING ──────────────────────────────────────────────
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

      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
        <div />
        {cols.map(c => (
          <div key={c} style={{ background: colColors[c], borderRadius: 6, padding: '8px 4px', textAlign: 'center' }}>
            <span style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>Column {c}</span>
          </div>
        ))}
      </div>

      {/* Rows */}
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

// ─── PART 2: SKILL RATINGS ────────────────────────────────────────────────────
function Part2({ ratings, setRatings, onBack, onNext, error }) {
  const scaleLabels = ['', 'Never', 'Rarely', 'Sometimes', 'Usually', 'Always']
  const scaleColors = ['', colors.red, '#BB3333', '#888888', '#555555', colors.black]

  const setRating = (sectionId, qIndex, val) => {
    setRatings(prev => {
      const next = { ...prev }
      next[sectionId] = [...prev[sectionId]]
      next[sectionId][qIndex] = val
      return next
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 4, height: 44, background: colors.red, borderRadius: 2 }} />
        <div>
          <h2 style={styles.h2}>Part 2 — Sales Skill Assessment</h2>
          <p style={{ fontSize: 14, color: colors.darkGray }}>Rate each statement <strong>1–5</strong> based on how consistently it describes you.</p>
        </div>
      </div>

      {/* Scale legend */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {[1,2,3,4,5].map(n => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6, background: colors.lightGray, borderRadius: 6, padding: '6px 12px' }}>
            <span style={{ fontWeight: 700, color: scaleColors[n], fontSize: 15 }}>{n}</span>
            <span style={{ fontSize: 12, color: colors.darkGray }}>{scaleLabels[n]}</span>
          </div>
        ))}
      </div>

      {skillSections.map((section, si) => {
        const rawScore = ratings[section.id].reduce((sum, v) => sum + (Number(v) || 0), 0)
        const allRated = ratings[section.id].every(v => v !== '')
        return (
          <div key={section.id} style={{ marginBottom: 28 }}>
            {/* Section header */}
            <div style={{ background: colors.black, borderRadius: '8px 8px 0 0', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: colors.white, fontWeight: 700, fontSize: 15 }}>{section.label}</span>
              <span style={{ color: colors.midGray, fontSize: 13, fontStyle: 'italic' }}>Questions {si * 4 + 1}–{si * 4 + 4}</span>
            </div>

            {/* Questions */}
            {section.questions.map((q, qi) => (
              <div key={qi} style={{
                display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center',
                background: qi % 2 === 0 ? colors.white : colors.lightGray,
                padding: '14px 16px', borderLeft: `3px solid ${colors.border}`, borderRight: `3px solid ${colors.border}`,
                borderBottom: `1px solid ${colors.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700, color: colors.red, fontSize: 15, minWidth: 24 }}>{si * 4 + qi + 1}</span>
                  <span style={{ fontSize: 14, color: colors.black, lineHeight: 1.5 }}>{q}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1,2,3,4,5].map(n => (
                    <button
                      key={n}
                      onClick={() => setRating(section.id, qi, String(n))}
                      style={{
                        width: 36, height: 36, borderRadius: 6, border: `2px solid`,
                        borderColor: ratings[section.id][qi] === String(n) ? scaleColors[n] : colors.border,
                        background: ratings[section.id][qi] === String(n) ? scaleColors[n] : colors.white,
                        color: ratings[section.id][qi] === String(n) ? colors.white : colors.darkGray,
                        fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Section score */}
            <div style={{ background: colors.lightGray, borderRadius: '0 0 8px 8px', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `3px solid ${colors.border}`, borderTop: 'none' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: colors.darkGray }}>{section.label} Raw Score</span>
              <span style={{ fontWeight: 700, color: allRated ? colors.red : colors.midGray, fontSize: 16 }}>
                {allRated ? rawScore : '_ _'} / 20
              </span>
            </div>
          </div>
        )
      })}

      {error && <div style={{ color: colors.red, fontSize: 14, padding: '10px 14px', background: '#FFF0F0', borderRadius: 6, marginBottom: 16 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button onClick={onBack} style={{ ...styles.btnSecondary, flex: '0 0 auto' }}>← Back</button>
        <button onClick={onNext} style={{ ...styles.btnPrimary, flex: 1 }}>Continue to Part 3 — Context  →</button>
      </div>
    </div>
  )
}

// ─── PART 3: CONTEXT QUESTIONS ────────────────────────────────────────────────
function Part3({ context, setContext, onBack, onSubmit, submitting, error }) {
  const setField = (id, val) => setContext(prev => ({ ...prev, [id]: val }))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 4, height: 44, background: colors.red, borderRadius: 2 }} />
        <div>
          <h2 style={styles.h2}>Part 3 — Context Questions</h2>
          <p style={{ fontSize: 14, color: colors.darkGray }}>These questions help personalize your report. They do not affect your scores.</p>
        </div>
      </div>

      {contextQuestions.map((q, i) => (
        <div key={q.id} style={{ marginBottom: 20 }}>
          <label style={styles.label}>
            {i + 1}. {q.question}
            {['industry','role','experience','challenge','goal'].includes(q.id) && (
              <span style={{ color: colors.red, marginLeft: 4 }}>*</span>
            )}
          </label>
          {q.type === 'text' ? (
            <input
              type="text"
              placeholder={q.placeholder}
              value={context[q.id]}
              onChange={e => setField(q.id, e.target.value)}
              style={{ ...styles.input, marginBottom: 0 }}
            />
          ) : (
            <select
              value={context[q.id]}
              onChange={e => setField(q.id, e.target.value)}
              style={{ ...styles.select, marginBottom: 0 }}
            >
              <option value="">Select an option...</option>
              {q.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          )}
        </div>
      ))}

      <div style={{ background: colors.lightGray, borderRadius: 8, padding: '14px 18px', marginTop: 8, marginBottom: 20, fontSize: 13, color: colors.darkGray }}>
        🎉 <strong>You're almost done!</strong> Click submit and your personalized BOOST Blueprint Report will be emailed to <strong>{/* contact email passed via prop */}</strong> within a few minutes.
      </div>

      {error && <div style={{ color: colors.red, fontSize: 14, padding: '10px 14px', background: '#FFF0F0', borderRadius: 6, marginBottom: 16 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={onBack} style={{ ...styles.btnSecondary, flex: '0 0 auto' }} disabled={submitting}>← Back</button>
        <button onClick={onSubmit} style={{ ...styles.btnPrimary, flex: 1 }} disabled={submitting}>
          {submitting ? '⏳ Generating your report...' : '🚀 Submit & Get My Report'}
        </button>
      </div>
    </div>
  )
}
