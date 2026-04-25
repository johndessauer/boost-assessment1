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

  try {
    const params = new URLSearchParams()
    params.append('payment_method_types[]', 'card')
    params.append('mode', 'payment')
    params.append('customer_email', contact.email)
    params.append('metadata[fullName]', contact.fullName)
    params.append('metadata[phone]', contact.phone)
    params.append('metadata[email]', contact.email)
    params.append('line_items[0][price_data][currency]', 'usd')
    params.append('line_items[0][price_data][unit_amount]', '9700')
    params.append('line_items[0][price_data][product_data][name]', 'BOOST Blueprint Sales Assessment')
    params.append('line_items[0][price_data][product_data][description]', 'Personalized 20+ page sales assessment report delivered to your inbox instantly.')
    params.append('line_items[0][quantity]', '1')
    params.append('allow_promotion_codes', 'true')
    params.append('success_url', `${baseUrl}/?session_id={CHECKOUT_SESSION_ID}`)
    params.append('cancel_url', `${baseUrl}/`)

    if (promoCode && promoCode.trim()) {
      try {
        const promoRes = await fetch(`https://api.stripe.com/v1/promotion_codes?code=${encodeURIComponent(promoCode.trim())}&active=true&limit=1`, { headers: { 'Authorization': authHeader } })
        const promoData = await promoRes.json()
        if (promoData.data && promoData.data.length > 0) {
          params.delete('allow_promotion_codes')
          params.append('discounts[0][promotion_code]', promoData.data[0].id)
        }
      } catch {}
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

export const config = { path: '/api/create-checkout' }
