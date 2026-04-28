export default async (req) => {
  console.log('TEST FUNCTION HIT')
  console.log('Method:', req.method)
  let body = 'none'
  try {
    const text = await req.text()
    console.log('Body length:', text.length)
    body = text.substring(0, 100)
  } catch (e) {
    console.log('Body read error:', e.message)
  }
  return new Response(JSON.stringify({ ok: true, body }), { headers: { 'Content-Type': 'application/json' } })
}
export const config = { path: '/api/test' }
