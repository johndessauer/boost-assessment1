import Stripe from 'stripe'

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const { contact, promoCode } = await req.json()
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  const baseUrl = req.headers.get('origin') || 'https://realwiseacademy.com'

  try {
    const sessionParams = {
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: contact.email,
      metadata: {
        fullName: contact.fullName,
        phone: contact.phone,
        email: contact.email,
      },
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: 9700,
          product_data: {
            name: 'BOOST Blueprint Sales Assessment',
            description: 'Personalized 20+ page sales assessment report — delivered to your inbox instantly.',
          },
        },
        quantity: 1,
      }],
      allow_promotion_codes: true,
      success_url: `${baseUrl}/assessment?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/assessment`,
    }

    // Apply promo code if provided
    if (promoCode) {
      try {
        const promos = await stripe.promotionCodes.list({ code: promoCode, active: true, limit: 1 })
        if (promos.data.length > 0) {
          sessionParams.discounts = [{ promotion_code: promos.data[0].id }]
          delete sessionParams.allow_promotion_codes
        }
      } catch {}
    }

    const session = await stripe.checkout.sessions.create(sessionParams)
    return new Response(JSON.stringify({ sessionId: session.id }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('Stripe error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const config = { path: '/api/create-checkout' }
