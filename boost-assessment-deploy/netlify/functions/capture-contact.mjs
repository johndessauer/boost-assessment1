export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const { fullName, email, phone } = await req.json()

  const apiKey = process.env.EMAIL_OCTOPUS_API_KEY
  const listId = process.env.EMAIL_OCTOPUS_LIST_ID

  try {
    await fetch(`https://emailoctopus.com/api/1.6/lists/${listId}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        email_address: email,
        fields: { FirstName: fullName.split(' ')[0], LastName: fullName.split(' ').slice(1).join(' '), Phone: phone },
        tags: ['boost-assessment-started'],
        status: 'SUBSCRIBED',
      }),
    })
  } catch (e) {
    console.error('Email Octopus contact capture error:', e)
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
}

export const config = { path: '/api/capture-contact' }
