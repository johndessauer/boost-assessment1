export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  
  let body
  try { body = await req.json() } catch (e) {
    console.error('JSON parse error:', e.message)
    return new Response(JSON.stringify({ ok: false, error: 'Invalid request' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const { contact } = body
  console.log('Assessment received for:', contact?.email)

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not set')
    return new Response(JSON.stringify({ ok: false, error: 'API key missing' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  let reportText = ''
  try {
    console.log('Calling Claude API with model: claude-opus-4-20250514')
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01' 
      },
      body: JSON.stringify({ 
        model: 'claude-opus-4-20250514',
        max_tokens: 500, 
        messages: [{ role: 'user', content: `Write a brief 2-paragraph summary for ${contact.fullName} about their sales assessment. Keep it encouraging and actionable.` }] 
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Claude API error:', response.status, errorText)
      throw new Error(`Claude API returned ${response.status}`)
    }

    const result = await response.json()
    console.log('Claude response received')
    
    if (result.error) {
      console.error('Claude error:', JSON.stringify(result.error))
      throw new Error(`Claude error: ${result.error.message}`)
    }

    reportText = (result.content && result.content[0]) ? result.content[0].text : ''
    if (!reportText) {
      console.error('No report text from Claude')
      throw new Error('Claude returned empty response')
    }
    
    console.log('Report generated, length:', reportText.length, 'chars')
    
  } catch (err) {
    console.error('Report generation error:', err.message)
    reportText = `Assessment Summary for ${contact.fullName}\n\nThank you for completing the BOOST Blueprint Assessment. Your personalized report is being prepared.\n\nBook your strategy call: https://realwiseacademy.com`
  }

  const html = `<!DOCTYPE html>
<html>
<head><meta name="color-scheme" content="light"></head>
<body style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:20px;background:#f8f8f8">
<div style="background:#fff;padding:30px;border-radius:8px">
<h1 style="color:#1A1A1A;margin-top:0">Your BOOST Blueprint Assessment</h1>
<p style="color:#666;font-size:16px;line-height:1.6">${reportText.replace(/\n/g, '</p><p style="color:#666;font-size:16px;line-height:1.6">')}</p>
<div style="margin-top:30px;text-align:center">
<a href="https://realwiseacademy.com/#programs" style="background:#1A5C38;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block">Book Your Strategy Call</a>
</div>
<p style="color:#999;font-size:12px;margin-top:40px;border-top:1px solid #eee;padding-top:20px">© 2026 Dessauer Group II LLC | RealWise Academy</p>
</div>
</body>
</html>`

  const okResponse = new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })

  try {
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      console.error('RESEND_API_KEY not set')
    } else {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + resendKey },
        body: JSON.stringify({ 
          from: 'John Dessauer | RealWise Academy <john@thedessauergroup.com>', 
          to: [contact.email], 
          subject: 'Your BOOST Blueprint Assessment - ' + contact.fullName, 
          html 
        }),
      })
      const emailResult = await res.json()
      console.log('Email sent:', emailResult.id || emailResult.error || 'unknown')
    }
  } catch (err) { 
    console.error('Email error:', err.message) 
  }

  console.log('Assessment submission complete for:', contact.email)
  return okResponse
}
