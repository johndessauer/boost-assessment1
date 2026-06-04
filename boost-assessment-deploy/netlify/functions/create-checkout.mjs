export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }
  let body
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
  const { contact, promoCode } = body
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return new Response(JSON.stringify({ error: 'Payment system not configured. Please contact support.' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
  const baseUrl = req.headers.get('origin') || 'https://boost-assessment.netlify.app'
  const authHeader = 'Basic ' + btoa(stripeKey + ':')

  const applyDiscount = promoCode && promoCode.toUpperCase() === 'BOOST67'

  try {
    const params = new URLSearchParams()
    params.append('payment_method_types[]', 'card')
    params.append('mode', 'payment')
    params.append('customer_email', contact.email)
    params.append('metadata[fullName]', contact.fullName)
    params.append('metadata[phone]', contact.phone || '')
    params.append('metadata[email]', contact.email)
    params.append('line_items[0][price]', 'price_1TeQhlD3UPBMwUPOEymhCPWd')
    params.append('line_items[0][quantity]', '1')
    params.append('success_url', `${baseUrl}/?session_id={CHECKOUT_SESSION_ID}`)
    params.append('cancel_url', `${baseUrl}/`)

    if (applyDiscount) {
      params.append('discounts[0][coupon]', 'BOOST67')
    } else {
      params.append('allow_promotion_codes', 'true')
    }

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    })
    const session = await res.json()
    if (session.error) {
      return new Response(JSON.stringify({ error: session.error.message }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ sessionId: session.id }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Payment setup failed. Please try again.' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
