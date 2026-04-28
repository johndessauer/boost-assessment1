import React, { useState } from 'react'
import { Header, StepIndicator, styles, colors } from '../styles.jsx'

export default function ContactCapture({ onSubmit }) {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const validate = () => {
    const e = {}
    if (!form.fullName.trim()) e.fullName = 'Full name is required'
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Valid email is required'
    if (!form.phone.trim()) e.phone = 'Phone number is required'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    // Save contact to Email Octopus as a subscriber immediately
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 4, height: 48, background: colors.red, borderRadius: 2 }} />
          <div>
            <h1 style={styles.h1}>Let's Get Started</h1>
            <p style={{ fontSize: 15, color: colors.darkGray }}>Your personalized BOOST Blueprint Report starts here.</p>
          </div>
        </div>

        <div style={styles.infoBox}>
          <p style={{ fontSize: 14, color: colors.black, lineHeight: 1.6 }}>
            <strong>What you'll receive:</strong> A fully personalized 20+ page sales assessment report including your color profile, BOOST skill scores, personalized diagnosis, a custom playbook, and a program recommendation — delivered to your inbox within minutes of completing the assessment.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {field('fullName', 'Full Name', 'text', 'Your full name')}
          {field('email', 'Email Address', 'email', 'your@email.com')}
          {field('phone', 'Phone Number', 'tel', '+1 (555) 000-0000')}

          <div style={styles.divider} />

          <button type="submit" style={styles.btnPrimary} disabled={loading}>
            {loading ? 'Please wait...' : 'Continue to Payment  →'}
          </button>

          <p style={{ textAlign: 'center', fontSize: 12, color: colors.midGray, marginTop: 16 }}>
            🔒 Your information is private and secure. We will never share or sell your data.
          </p>
        </form>
      </div>
    </div>
  )
}
