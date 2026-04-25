import React, { useState } from 'react'
import ContactCapture from './components/ContactCapture.jsx'
import PaymentGate from './components/PaymentGate.jsx'
import Assessment from './components/Assessment.jsx'
import ThankYou from './components/ThankYou.jsx'

const STEPS = { CONTACT: 'contact', PAYMENT: 'payment', ASSESSMENT: 'assessment', DONE: 'done' }

export default function App() {
  const [step, setStep] = useState(STEPS.CONTACT)
  const [contact, setContact] = useState(null)
  const [paymentIntent, setPaymentIntent] = useState(null)

  const handleContactSubmit = (data) => {
    setContact(data)
    setStep(STEPS.PAYMENT)
  }

  const handlePaymentSuccess = (piId) => {
    setPaymentIntent(piId)
    setStep(STEPS.ASSESSMENT)
  }

  const handleAssessmentSubmit = () => {
    setStep(STEPS.DONE)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f8f8' }}>
      {step === STEPS.CONTACT && <ContactCapture onSubmit={handleContactSubmit} />}
      {step === STEPS.PAYMENT && <PaymentGate contact={contact} onSuccess={handlePaymentSuccess} />}
      {step === STEPS.ASSESSMENT && <Assessment contact={contact} paymentIntent={paymentIntent} onSubmit={handleAssessmentSubmit} />}
      {step === STEPS.DONE && <ThankYou contact={contact} />}
    </div>
  )
}
