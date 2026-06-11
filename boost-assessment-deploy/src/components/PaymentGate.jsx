import React, { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Header, StepIndicator, styles, colors } from '../styles.jsx'

const stripePromise = loadStripe('pk_live_51KGmaCD3UPBMwUPOTfRaCtroBU0OpQeVtMfquZka3G5ndteJ13p8nXDF8opRqOipWAlm8qYL1lhZ6JxbHlHglEmp00D88R9JXo')

const BYPASS_CODE = import.meta.env.VITE_BYPASS_CODE || ''
const PROMO_CODE = 'BOOST67'
const GUARANTEE_BADGE = 'https://raw.githubusercontent.com/johndessauer/boost-assessment1/main/boost-assessment-deploy/Public%3AMoney%20Back%20Guarantee%20Badge%20Seal.png'

export default function PaymentGate({ contact, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [promoCode, setPromoCode] = useState('BOOST67')
  const [isPromoApplied, setIsPromoApplied] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const hasUTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].some(p => params.get(p))
    if (hasUTM) {
      setPromoCode(PROMO_CODE)
      setIsPromoApplied(true)
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')
    if (sessionId) {
      onSuccess(sessionId)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const handlePromoChange = (e) => {
    const val = e.target.value.toUpperCase()
    setPromoCode(val)
    setIsPromoApplied(val === PROMO_CODE)
  }

  const handleCheckout = async () => {
    setLoading(true)
    setError('')

    if (BYPASS_CODE && promoCode.trim().toUpperCase() === BYPASS_CODE.toUpperCase()) {
      onSuccess('BYPASS')
      return
    }

    try {
      const res = await fetch('/.netlify/functions/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact, promoCode: isPromoApplied ? PROMO_CODE : '' }),
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

  return (
    <div style={styles.page}>
      <Header />
      <div style={styles.card}>
        <StepIndicator current={1} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 4, height: 48, background: '#84cc16', borderRadius: 2 }} />
          <div>
            <h1 style={styles.h1}>Complete Your Purchase — Offer Expires June 17</h1>
            <p style={{ fontSize: 15, color: colors.darkGray }}>Welcome, {contact?.fullName?.split(' ')[0]}! Lock in your 33% discount before June 17 and get your personalized BOOST report within minutes.</p>
          </div>
        </div>

        <div style={{ background: colors.lightGray, borderRadius: 10, padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>BOOST Blueprint Sales Assessment</span>
            {isPromoApplied ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, color: colors.midGray, textDecoration: 'line-through' }}>$97</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>$67</span>
              </div>
            ) : (
              <span style={{ fontSize: 18, fontWeight: 800, color: colors.red }}>$97</span>
            )}
          </div>
          {isPromoApplied && (
            <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 600, marginBottom: 8 }}>
              ✓ Promo code BOOST67 applied — you save $30
            </div>
          )}
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li style={{ fontSize: 13, color: colors.darkGray, marginBottom: 4 }}>Personality profile + secondary color analysis</li>
            <li style={{ fontSize: 13, color: colors.darkGray, marginBottom: 4 }}>BOOST skill scores across all 5 pillars</li>
            <li style={{ fontSize: 13, color: colors.darkGray, marginBottom: 4 }}>Personalized diagnosis — where wiring meets skill gap</li>
            <li style={{ fontSize: 13, color: colors.darkGray, marginBottom: 4 }}>Custom BOOST Playbook with actionable steps</li>
            <li style={{ fontSize: 13, color: colors.darkGray, marginBottom: 4 }}>Program recommendation tailored to your profile</li>
          </ul>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={styles.label}>Promo Code (optional)</label>
          <input
            type="text"
            placeholder="Enter promo code"
            value={promoCode}
            onChange={handlePromoChange}
            style={{ ...styles.input, marginBottom: 0, borderColor: isPromoApplied ? '#16a34a' : colors.border }}
          />
        </div>

        {error && (
          <div style={{ background: '#FFF0F0', border: `1px solid ${colors.red}`, borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 14, color: colors.red }}>
            {error}
          </div>
        )}

        <div style={styles.divider} />

        <p style={{ textAlign: 'center', fontSize: 14, color: '#dc2626', fontWeight: 700, marginBottom: 12 }}>
          ⚡ $67 offer expires June 17 — regular price returns to $97
        </p>

        <button onClick={handleCheckout} style={styles.btnPrimary} disabled={loading}>
          {loading ? 'Redirecting to secure checkout...' : `🔒  Pay ${isPromoApplied ? '$67' : '$97'} & Start Assessment`}
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
          <img src={GUARANTEE_BADGE} alt="100% Money Back Guarantee" style={{ width: 100, height: 100, objectFit: 'contain', marginBottom: 8 }} />
          <p style={{ textAlign: 'center', fontSize: 12, color: colors.midGray, margin: 0, maxWidth: 280 }}>
            100% Money Back Guarantee — If you don't find value in your report, we'll make it right.
          </p>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: colors.midGray, marginTop: 8 }}>
          Secured by Stripe. Your report will be emailed to <strong>{contact?.email}</strong> within minutes of completing the assessment.
        </p>
      </div>
    </div>
  )
}
