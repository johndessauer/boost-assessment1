import React, { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Header, StepIndicator, styles, colors } from '../styles.jsx'

const stripePromise = loadStripe('pk_live_51KGmaCD3UPBMwUPOTfRaCtroBU0OpQeVtMfquZka3G5ndteJ13p8nXDF8opRqOipWAlm8qYL1lhZ6JxbHlHglEmp00D88R9JXo')

export default function PaymentGate({ contact, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [promoApplied, setPromoApplied] = useState(false)
  const [finalPrice, setFinalPrice] = useState(97)

  const handleCheckout = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/.netlify/functions/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact,
          promoCode: promoCode.trim() || null,
        }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); setLoading(false); return }

      const stripe = await stripePromise
      const { error: stripeError } = await stripe.redirectToCheckout({ sessionId: data.sessionId })
      if (stripeError) { setError(stripeError.message); setLoading(false) }
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  // Check for payment success redirect from Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')
    if (sessionId) {
      onSuccess(sessionId)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  return (
    <div style={styles.page}>
      <Header />
      <div style={styles.card}>
        <StepIndicator current={1} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 4, height: 48, background: colors.red, borderRadius: 2 }} />
          <div>
            <h1 style={styles.h1}>Complete Your Purchase</h1>
            <p style={{ fontSize: 15, color: colors.darkGray }}>Welcome, {contact?.fullName?.split(' ')[0]}! One step away from your report.</p>
          </div>
        </div>

        {/* Order summary */}
        <div style={{ background: colors.lightGray, borderRadius: 10, padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>BOOST Blueprint Sales Assessment</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: colors.red }}>$97</span>
          </div>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {[
              'Personality profile + secondary color analysis',
              'BOOST skill scores across all 5 pillars',
              'Personalized diagnosis — where wiring meets skill gap',
              'Custom BOOST Playbook with actionable steps',
              'Program recommendation tailored to your profile',
            ].map(item => (
              <li key={item} style={{ fontSize: 13, color: colors.darkGray, marginBottom: 4 }}>{item}</li>
            ))}
          </ul>
        </div>

        {/* Promo code */}
        <div style={{ marginBottom: 20 }}>
          <label style={styles.label}>Promo Code (optional)</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="text"
              placeholder="Enter promo code"
              value={promoCode}
              onChange={e => setPromoCode(e.target.value.toUpperCase())}
              style={{ ...styles.input, marginBottom: 0, flex: 1 }}
            />
          </div>
        </div>

        {error && (
          <div style={{ background: '#FFF0F0', border: `1px solid ${colors.red}`, borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 14, color: colors.red }}>
            {error}
          </div>
        )}

        <div style={styles.divider} />

        <button onClick={handleCheckout} style={styles.btnPrimary} disabled={loading}>
          {loading ? 'Redirecting to secure checkout...' : '🔒  Pay $97 & Start Assessment'}
        </button>

        <p style={{ textAlign: 'center', fontSize: 12, color: colors.midGray, marginTop: 16 }}>
          Secured by Stripe. Your report will be emailed to <strong>{contact?.email}</strong> within minutes of completing the assessment.
        </p>
      </div>
    </div>
  )
}
