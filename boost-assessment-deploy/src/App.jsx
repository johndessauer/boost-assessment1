import React, { useState, useEffect } from 'react'
import ContactCapture from './components/ContactCapture.jsx'
import PaymentGate from './components/PaymentGate.jsx'
import Assessment from './components/Assessment.jsx'
import ThankYou from './components/ThankYou.jsx'

const STEPS = { CONTACT: 'contact', PAYMENT: 'payment', ASSESSMENT: 'assessment', DONE: 'done' }

const STEP_PATHS = {
  contact: '/contact',
  payment: '/payment',
  assessment: '/assessment',
  done: '/thankyou',
}

const FREE_ACCESS_CODES = ['equip']

export default function App() {
  const [step, setStep] = useState(STEPS.CONTACT)
  const [contact, setContact] = useState(null)
  const [paymentIntent, setPaymentIntent] = useState(null)
  const [freeAccess, setFreeAccess] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    // Check for free access code in URL
    const accessCode = params.get('access')
    if (accessCode && FREE_ACCESS_CODES.includes(accessCode.toLowerCase())) {
      setFreeAccess(true)
      sessionStorage.setItem('free_access', 'true')
    }

    // Check for returning Stripe session
    const sessionId = params.get('session_id')
    if (sessionId) {
      const savedContact = sessionStorage.getItem('boost_contact')
      if (savedContact) {
        setContact(JSON.parse(savedContact))
      }
      setPaymentIntent(sessionId)
      setStep(STEPS.ASSESSMENT)
      window.history.replaceState({}, '', window.location.pathname)
    }

    // Restore free access from session if page reloads
    if (sessionStorage.getItem('free_access') === 'true') {
      setFreeAccess(true)
    }
  }, [])

  // Fire GA4 virtual page view on every step change
  useEffect(() => {
    if (typeof gtag === 'function') {
      gtag('event', 'page_view', {
        page_path: STEP_PATHS[step],
        page_title: step.charAt(0).toUpperCase() + step.slice(1),
      })
    }
  }, [step])

  const handleContactSubmit = (data) => {
    sessionStorage.setItem('boost_contact', JSON.stringify(data))
    setContact(data)
    // Skip payment if free access code was used
    if (freeAccess || sessionStorage.getItem('free_access') === 'true') {
      setPaymentIntent('FREE_ACCESS')
      setStep(STEPS.ASSESSMENT)
    } else {
      setStep(STEPS.PAYMENT)
    }
  }

  const handlePaymentSuccess = (piId) => {
    setPaymentIntent(piId)
    setStep(STEPS.ASSESSMENT)
  }

  const handleAssessmentSubmit = () => {
    sessionStorage.removeItem('boost_contact')
    sessionStorage.removeItem('free_access')
    setTimeout(() => {
      setStep(STEPS.DONE)
    }, 1000)
  }

  const activeContact = contact || { fullName: 'Test User', email: 'test@example.com', phone: '555-0000' }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f8f8' }}>
      {step === STEPS.CONTACT && <ContactCapture onSubmit={handleContactSubmit} />}
      {step === STEPS.PAYMENT && contact && <PaymentGate contact={contact} onSuccess={handlePaymentSuccess} />}
      {step === STEPS.ASSESSMENT && <Assessment contact={activeContact} paymentIntent={paymentIntent} onSubmit={handleAssessmentSubmit} />}
      {step === STEPS.DONE && <ThankYou contact={activeContact} />}
    </div>
  )
}
