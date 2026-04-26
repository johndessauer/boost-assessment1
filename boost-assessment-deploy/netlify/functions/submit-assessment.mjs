import { calculatePersonalityProfile, calculateBoostScores, getProgramRecommendation } from '../../src/config.js'

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let body
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid request' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const { contact, paymentIntent, rankings, ratings, context } = body

  // Verify payment first
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (stripeKey && paymentIntent) {
    try {
      const authHeader = 'Basic ' + btoa(stripeKey + ':')
      const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${paymentIntent}`, {
        headers: { 'Authorization': authHeader }
      })
      const session = await res.json()
      if (session.payment_status !== 'paid') {
        return new Response(JSON.stringify({ ok: false, error: 'Payment not verified.' }), {
          status: 402, headers: { 'Content-Type': 'application/json' }
        })
      }
    } catch (err) {
      console.error('Payment verification error:', err.message)
    }
  }

  // Score the assessment
  const personality = calculatePersonalityProfile(rankings)
  const boostScores = calculateBoostScores(ratings)
  const program = getProgramRecommendation(boostScores, context)
  const scoreEntries = Object.values(boostScores)
  const primaryGap = scoreEntries.reduce((a, b) => a.score < b.score ? a : b)
  const topStrength = scoreEntries.reduce((a, b) => a.score > b.score ? a : b)
  const assessmentData = { contact, personality, boostScores, program, primaryGap, topStrength, context }

  // Call the background function to handle report generation and emails
  const baseUrl = req.headers.get('origin') || 'https://boost-assessment.netlify.app'
  fetch(`${baseUrl}/.netlify/functions/submit-assessment-background`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(assessmentData),
  }).catch(err => console.error('Background function trigger error:', err.message))

  // Return immediately
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
}

export const config = { path: '/api/submit-assessment' }
