import React, { useState } from 'react'
import { Header, StepIndicator, styles, colors } from '../styles.jsx'

const GUARANTEE_BADGE = 'https://raw.githubusercontent.com/johndessauer/boost-assessment1/main/boost-assessment-deploy/Public%3AMoney%20Back%20Guarantee%20Badge%20Seal.png'

export default function ContactCapture({ onSubmit }) {
  const [form, setForm] = useState({ fullName: '', email: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const validate = () => {
    const e = {}
    if (!form.fullName.trim()) e.fullName = 'Full name is required'
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Valid email is required'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      await fetch('/.netlify/functions/capture-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
    } catch {}
    setLoading(false)
    onSubmit(form)
  }

  const field = (id, label, type = 'text', placeholder = '') => (
    <div key={id}>
      <label style={styles.label}>{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={form[id]}
        onChange={ev => setForm(f => ({ ...f, [id]: ev.target.value }))}
        style={{ ...styles.input, borderColor: errors[id] ? colors.red : colors.border }}
      />
      {errors[id] && <div style={{ color: colors.red, fontSize: 13, marginTop: -14, marginBottom: 12 }}>{errors[id]}</div>}
    </div>
  )

  return (
    <div style={styles.page}>
      <Header />
      <div style={styles.card}>
        <StepIndicator current={0} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 4, height: 48, background: '#84cc16', borderRadius: 2 }} />
          <div>
            <h1 style={styles.h1}>You Clicked to Prove It. Now Let's Find Out.</h1>
            <p style={{ fontSize: 15, color: '#16a34a', fontWeight: 600, marginTop: 6 }}>
              Only the <strong>top 5%</strong> of sales pros score an <strong>"Elite"</strong> ranking on this assessment. Are you one of them — or are you leaving commissions on the table?
            </p>
          </div>
        </div>
        <p style={{ fontSize: 13, color: colors.darkGray, marginBottom: 16, marginLeft: 16, lineHeight: 1.5 }}>
          Built by <strong>John Dessauer</strong> — Sales strategist, author, and trainer to 1,200+ professionals across medical, automotive, real estate, software, and corporate sales.
        </p>
        <p style={{ fontSize: 14, color: '#16a34a', fontWeight: 600, marginBottom: 20, marginLeft: 16 }}>
          $67 today with code BOOST67 (reg. $97) — offer expires June 17 · less than 10 minutes
        </p>
        <div style={styles.infoBox}>
          <p style={{ fontSize: 14, color: colors.black, fontWeight: 700, marginBottom: 10 }}>What you'll receive:</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li style={{ fontSize: 14, color: colors.black, lineHeight: 1.6, marginBottom: 4 }}>✅ Your color personality profile + secondary style analysis</li>
            <li style={{ fontSize: 14, color: colors.black, lineHeight: 1.6, marginBottom: 4 }}>✅ BOOST skill scores across all 5 sales pillars</li>
            <li style={{ fontSize: 14, color: colors.black, lineHeight: 1.6, marginBottom: 4 }}>✅ Personalized diagnosis — where your wiring meets your skill gap</li>
            <li style={{ fontSize: 14, color: colors.black, lineHeight: 1.6, marginBottom: 4 }}>✅ A custom BOOST Playbook with your specific action steps</li>
            <li style={{ fontSize: 14, color: colors.black, lineHeight: 1.6, marginBottom: 4 }}>✅ A program recommendation tailored to your exact profile</li>
            <li style={{ fontSize: 14, color: colors.black, lineHeight: 1.6, marginBottom: 4 }}>✅ Delivered to your inbox within minutes of completing the assessment</li>
          </ul>
        </div>
        <div style={{ background: '#f8f8f8', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: colors.black, marginBottom: 10 }}>Results sales professionals experience:</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li style={{ fontSize: 13, color: colors.darkGray, lineHeight: 1.6, marginBottom: 6 }}>💡 <em>"Identified gaps I didn't know I had — after 14 years in sales."</em></li>
            <li style={{ fontSize: 13, color: colors.darkGray, lineHeight: 1.6, marginBottom: 6 }}>🎯 <em>"Showed me exactly why I was stalling at the close."</em></li>
            <li style={{ fontSize: 13, color: colors.darkGray, lineHeight: 1.6, marginBottom: 6 }}>📈 <em>"More useful than a full day of training."</em></li>
          </ul>
          <p style={{ fontSize: 12, color: colors.midGray, marginTop: 10, marginBottom: 0 }}>
            Based on feedback from sales professionals across medical, automotive, real estate, software, and corporate industries.
          </p>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          {field('fullName', 'Full Name', 'text', 'Your full name')}
          {field('email', 'Email Address', 'email', 'your@email.com')}
          <div style={styles.divider} />
          <p style={{ textAlign: 'center', fontSize: 14, color: '#dc2626', fontWeight: 700, marginBottom: 16 }}>
            ⚡ Limited time: 33% off expires June 17
          </p>
          <button type="submit" style={styles.btnPrimary} disabled={loading}>
            {loading ? 'Please wait...' : 'Find My Sales Blind Spots →'}
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
            <img src={GUARANTEE_BADGE} alt="100% Money Back Guarantee" style={{ width: 100, height: 100, objectFit: 'contain', marginBottom: 8 }} />
            <p style={{ textAlign: 'center', fontSize: 12, color: colors.midGray, margin: 0, maxWidth: 280 }}>
              100% Money Back Guarantee — If you don't find value in your report, we'll make it right.
            </p>
          </div>
          <p style={{ textAlign: 'center', fontSize: 12, color: colors.midGray, marginTop: 8 }}>
            🔒 Your information is private and secure. We will never share or sell your data.
          </p>
        </form>
      </div>
    </div>
  )
}
