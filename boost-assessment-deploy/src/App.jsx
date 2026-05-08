import React, { useState, useEffect } from 'react'
import ContactCapture from './components/ContactCapture.jsx'
import PaymentGate from './components/PaymentGate.jsx'
import Assessment from './components/Assessment.jsx'
import ThankYou from './components/ThankYou.jsx'

const STEPS = { CONTACT: 'contact', PAYMENT: 'payment', ASSESSMENT: 'assessment', DONE: 'done' }

export default function App() {
  const [step, setStep] = useState(STEPS.CONTACT)
  const [contact, setContact] = useState(null)
  const [paymentIntent, setPaymentIntent] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
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
  }, [])

  const handleContactSubmit = (data) => {
    sessionStorage.setItem('boost_contact', JSON.stringify(data))
    setContact(data)
    setStep(STEPS.PAYMENT)
  }

  const handlePaymentSuccess = (piId) => {
    setPaymentIntent(piId)
    setStep(STEPS.ASSESSMENT)
  }

  const handleAssessmentSubmit = () => {
    sessionStorage.removeItem('boost_contact')
    setTimeout(() => {
      setStep(STEPS.DONE)
    }, 1000)
  }

  // For testing: if no contact, use default
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
