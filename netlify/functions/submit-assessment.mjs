import { calculatePersonalityProfile, calculateBoostScores, getProgramRecommendation } from '../../src/config.js'

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let body
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid request' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const { contact, paymentIntent, rankings, ratings, context } = body
  console.log('Assessment received for:', contact?.email)

  // Verify payment
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (stripeKey && paymentIntent) {
    try {
      const authHeader = 'Basic ' + btoa(stripeKey + ':')
      const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${paymentIntent}`, {
        headers: { 'Authorization': authHeader }
      })
      const session = await res.json()
      console.log('Payment status:', session.payment_status)
      if (session.payment_status !== 'paid') {
        return new Response(JSON.stringify({ ok: false, error: 'Payment not verified.' }), { status: 402, headers: { 'Content-Type': 'application/json' } })
      }
    } catch (err) {
      console.error('Payment verification error:', err.message)
    }
  }

  // Score
  const personality = calculatePersonalityProfile(rankings)
  const boostScores = calculateBoostScores(ratings)
  const program = getProgramRecommendation(boostScores, context)
  const scoreEntries = Object.values(boostScores)
  const primaryGap = scoreEntries.reduce((a, b) => a.score < b.score ? a : b)
  const topStrength = scoreEntries.reduce((a, b) => a.score > b.score ? a : b)
  console.log('Profile:', personality.primaryProfile.name, '| Gap:', primaryGap.pillar, '| Program:', program)

  // Generate report with Haiku (fast)
  let reportText = ''
  try {
    const prompt = `Write a personalized BOOST Blueprint Sales Assessment Report for ${contact.fullName}.

Profile: ${personality.primaryProfile.name} (${personality.primaryProfile.style}) primary, ${personality.secondaryProfile.name} secondary
Industry: ${context.industry || 'Sales'} | Role: ${context.role || 'Sales Professional'}
Scores: ${Object.values(boostScores).map(s => `${s.pillar}: ${s.score} (${s.status})`).join(', ')}
Top Strength: ${topStrength.pillar} (${topStrength.score}) | Gap: ${primaryGap.pillar} (${primaryGap.score})
Program: ${program}

Write these 7 sections (2-3 paragraphs each):
SECTION 1 — YOUR COLOR PROFILE
SECTION 2 — YOUR BOOST SCORE DASHBOARD  
SECTION 3 — WHERE YOUR WIRING MEETS YOUR SKILL GAP
SECTION 4 — THE BOOST BLUEPRINT
SECTION 5 — YOUR PERSONALIZED PLAYBOOK
SECTION 6 — YOUR PROGRAM RECOMMENDATION
SECTION 7 — YOUR NEXT STEP (CTA to book strategy call at RealWiseAcademy.com)`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
    })
    const result = await response.json()
    console.log('Claude response type:', result.type, 'stop_reason:', result.stop_reason)
    if (result.content && result.content[0]) {
      reportText = result.content[0].text
      console.log('Report generated, length:', reportText.length)
    } else {
      console.error('Claude error:', JSON.stringify(result).substring(0, 300))
      reportText = `BOOST Blueprint Report for ${contact.fullName}\n\nProfile: ${personality.primaryProfile.name} | Gap: ${primaryGap.pillar} | Program: ${program}\n\nYour full report will follow shortly. Book your strategy call at RealWiseAcademy.com`
    }
  } catch (err) {
    console.error('Report generation failed:', err.message)
    reportText = `BOOST Blueprint Report for ${contact.fullName}\n\nProfile: ${personality.primaryProfile.name} | Gap: ${primaryGap.pillar} | Program: ${program}\n\nBook your strategy call at RealWiseAcademy.com`
  }

  // Send respondent email
  try {
    const scoreRows = Object.values(boostScores).map(s =>
      `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600">${s.pillar}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-weight:700;color:${s.status==='Strength'?'#1A7A4A':s.status==='Developing'?'#C8922A':'#E4181B'}">${s.score}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;color:${s.status==='Strength'?'#1A7A4A':s.status==='Developing'?'#C8922A':'#E4181B'}">${s.status}</td></tr>`
    ).join('')
    const reportHtml = reportText.split('\n').map(line => line.startsWith('SECTION') ? `<h3 style="color:#E4181B;margin:20px 0 8px">${line}</h3>` : line.trim() ? `<p style="margin:0 0 10px;line-height:1.7">${line}</p>` : '<br>').join('')
    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8f8f8;font-family:Arial,sans-serif"><div style="max-width:680px;margin:0 auto;background:#fff"><div style="background:#1A1A1A;padding:24px 32px"><h1 style="color:#fff;margin:0">THE BOOST BLUEPRINT</h1><p style="color:#999;margin:4px 0 0;font-size:14px">Sales Assessment Report — RealWise Academy</p></div><div style="background:#E4181B;padding:16px 32px"><h2 style="color:#fff;margin:0">Your Report is Ready, ${contact.fullName.split(' ')[0]}!</h2></div><div style="padding:24px 32px;background:#f8f8f8"><table width="100%" cellpadding="0" cellspacing="6"><tr><td style="background:#6B3FA0;border-radius:8px;padding:10px;text-align:center;color:#fff"><div style="font-size:10px;opacity:.8">PRIMARY</div><div style="font-size:16px;font-weight:800">${personality.primaryProfile.name}</div></td><td style="width:6px"></td><td style="background:#C8922A;border-radius:8px;padding:10px;text-align:center;color:#fff"><div style="font-size:10px;opacity:.8">SECONDARY</div><div style="font-size:16px;font-weight:800">${personality.secondaryProfile.name}</div></td><td style="width:6px"></td><td style="background:#1A7A4A;border-radius:8px;padding:10px;text-align:center;color:#fff"><div style="font-size:10px;opacity:.8">TOP STRENGTH</div><div style="font-size:14px;font-weight:800">${topStrength.pillar} (${topStrength.score})</div></td><td style="width:6px"></td><td style="background:#E4181B;border-radius:8px;padding:10px;text-align:center;color:#fff"><div style="font-size:10px;opacity:.8">PRIMARY GAP</div><div style="font-size:14px;font-weight:800">${primaryGap.pillar} (${primaryGap.score})</div></td></tr></table></div><div style="padding:0 32px 24px"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden"><tr style="background:#1A1A1A"><th style="padding:10px 12px;color:#fff;text-align:left">Pillar</th><th style="padding:10px 12px;color:#fff;text-align:center">Score</th><th style="padding:10px 12px;color:#fff;text-align:center">Status</th></tr>${scoreRows}</table></div><div style="padding:0 32px 32px;font-size:15px;color:#1A1A1A">${reportHtml}</div><div style="margin:0 32px 32px;background:#1A1A1A;border-radius:12px;padding:28px 32px;text-align:center"><h3 style="color:#fff;margin:0 0 8px">Ready to Build on This?</h3><p style="color:#999;font-size:14px;margin:0 0 20px">Book a complimentary 30-minute Strategy Call with John Dessauer.</p><a href="https://realwiseacademy.com/#programs" style="display:inline-block;background:#E4181B;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700">Book Your Strategy Call →</a></div><div style="padding:20px 32px;border-top:1px solid #eee;text-align:center"><p style="font-size:12px;color:#999;margin:0">© 2026 Dessauer Group II LLC | RealWise Academy</p></div></div></body></html>`

    const res = await fetch('https://emailoctopus.com/api/1.6/campaigns/transactional', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: process.env.EMAIL_OCTOPUS_API_KEY, to: [{ email_address: contact.email, fields: { FirstName: contact.fullName.split(' ')[0] } }], from: { name: 'John Dessauer | RealWise Academy', email_address: 'john@thedessauergroup.com' }, subject: `Your BOOST Blueprint Report is Ready, ${contact.fullName.split(' ')[0]}!`, content: { html } }),
    })
    const emailResult = await res.json()
    console.log('Respondent email result:', JSON.stringify(emailResult).substring(0, 200))
  } catch (err) {
    console.error('Respondent email error:', err.message)
  }

  // Send owner email
  try {
    const telLink = `tel:${contact.phone.replace(/\D/g, '')}`
    const ownerHtml = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><div style="background:#1A1A1A;padding:20px;border-radius:8px 8px 0 0"><h2 style="color:#fff;margin:0">🎯 New Assessment — ${contact.fullName}</h2></div><div style="background:#E4181B;padding:12px 20px"><h3 style="color:#fff;margin:0">${personality.primaryProfile.name}/${personality.secondaryProfile.name} | Gap: ${primaryGap.pillar} (${primaryGap.score})</h3></div><div style="border:1px solid #eee;border-top:none;padding:20px;border-radius:0 0 8px 8px"><table cellpadding="6" cellspacing="0" width="100%"><tr><td style="font-weight:600;width:130px">Name:</td><td>${contact.fullName}</td></tr><tr><td style="font-weight:600">Email:</td><td><a href="mailto:${contact.email}" style="color:#E4181B">${contact.email}</a></td></tr><tr><td style="font-weight:600">Phone:</td><td><a href="${telLink}" style="color:#E4181B;font-size:18px;font-weight:700">📞 ${contact.phone}</a></td></tr><tr><td style="font-weight:600">Industry:</td><td>${context.industry || 'N/A'}</td></tr><tr><td style="font-weight:600">Role:</td><td>${context.role || 'N/A'}</td></tr><tr><td style="font-weight:600">Gap:</td><td style="color:#E4181B;font-weight:700">${primaryGap.pillar} (${primaryGap.score})</td></tr><tr><td style="font-weight:600">Program:</td><td><strong>${program}</strong></td></tr></table><div style="margin-top:20px;text-align:center"><a href="${telLink}" style="display:inline-block;background:#E4181B;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:18px">📞 Call ${contact.fullName.split(' ')[0]} Now</a></div></div></body></html>`

    const res = await fetch('https://emailoctopus.com/api/1.6/campaigns/transactional', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: process.env.EMAIL_OCTOPUS_API_KEY, to: [{ email_address: process.env.OWNER_EMAIL }], from: { name: 'BOOST Assessment System', email_address: 'john@thedessauergroup.com' }, subject: `🎯 New: ${contact.fullName} — ${personality.primaryProfile.name} | Gap: ${primaryGap.pillar}`, content: { html: ownerHtml } }),
    })
    const ownerResult = await res.json()
    console.log('Owner email result:', JSON.stringify(ownerResult).substring(0, 200))
  } catch (err) {
    console.error('Owner email error:', err.message)
  }

  // Tag in Email Octopus
  try {
    await fetch(`https://emailoctopus.com/api/1.6/lists/${process.env.EMAIL_OCTOPUS_LIST_ID}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: process.env.EMAIL_OCTOPUS_API_KEY, email_address: contact.email, fields: { FirstName: contact.fullName.split(' ')[0], LastName: contact.fullName.split(' ').slice(1).join(' '), Phone: contact.phone }, tags: ['boost-assessment-completed', `profile-${personality.primaryProfile.name.toLowerCase()}`, `gap-${primaryGap.pillar.toLowerCase().replace(/ /g, '-')}`], status: 'SUBSCRIBED' }),
    })
    console.log('Email Octopus tagged')
  } catch (err) {
    console.error('Email Octopus error:', err.message)
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
}

export const config = { path: '/api/submit-assessment' }
