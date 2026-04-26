import { calculatePersonalityProfile, calculateBoostScores, getProgramRecommendation } from '../../src/config.js'

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let body
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid request' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const { contact, paymentIntent, rankings, ratings, context } = body

  // ── Verify payment ──────────────────────────────────────────────────────────
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

  // ── Score the assessment ────────────────────────────────────────────────────
  const personality = calculatePersonalityProfile(rankings)
  const boostScores = calculateBoostScores(ratings)
  const program = getProgramRecommendation(boostScores, context)
  const scoreEntries = Object.values(boostScores)
  const primaryGap = scoreEntries.reduce((a, b) => a.score < b.score ? a : b)
  const topStrength = scoreEntries.reduce((a, b) => a.score > b.score ? a : b)

  const assessmentData = { contact, personality, boostScores, program, primaryGap, topStrength, context, timestamp: new Date().toISOString() }

  // ── Return success immediately then process report ──────────────────────────
  // Use waitUntil pattern to continue processing after response
  const responsePromise = processReport(assessmentData)

  // Return ok immediately so user sees thank you page
  // Fire and forget the report generation
  responsePromise.catch(err => console.error('Report processing error:', err.message))

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
}

async function processReport(assessmentData) {
  const { contact, personality, boostScores, program, primaryGap, topStrength, context } = assessmentData

  // ── Generate report ─────────────────────────────────────────────────────────
  let reportText = ''
  try {
    reportText = await generateReport(assessmentData)
    console.log('Report generated successfully for:', contact.fullName)
  } catch (err) {
    console.error('Report generation error:', err.message)
    reportText = buildFallbackReport(assessmentData)
  }

  // ── Send emails ─────────────────────────────────────────────────────────────
  try {
    await sendRespondentEmail(contact, reportText, assessmentData)
    console.log('Respondent email sent to:', contact.email)
  } catch (err) {
    console.error('Respondent email error:', err.message)
  }

  try {
    await sendOwnerEmail(contact, assessmentData)
    console.log('Owner email sent')
  } catch (err) {
    console.error('Owner email error:', err.message)
  }

  try {
    await tagEmailOctopus(contact, personality, primaryGap, program)
    console.log('Email Octopus tagged')
  } catch (err) {
    console.error('Email Octopus error:', err.message)
  }
}

// ── Generate report via Claude API ────────────────────────────────────────────
async function generateReport(data) {
  const { contact, personality, boostScores, program, primaryGap, topStrength, context } = data

  const scoresSummary = Object.values(boostScores).map(s =>
    `${s.pillar} (${s.pillarLetter}): ${s.score}/100 — ${s.status}`
  ).join('\n')

  const prompt = `You are generating a personalized BOOST Blueprint Sales Assessment Report for ${contact.fullName}.

RESPONDENT PROFILE:
- Name: ${contact.fullName}
- Role: ${context.role || 'Sales Professional'}
- Industry: ${context.industry || 'Sales'}
- Experience: ${context.experience || 'Unknown'}
- Primary Challenge: ${context.challenge || 'Not specified'}
- Primary Goal: ${context.goal || 'Not specified'}

PERSONALITY PROFILE:
- Primary: ${personality.primaryProfile.name} — ${personality.primaryProfile.style}
- Secondary: ${personality.secondaryProfile.name} — ${personality.secondaryProfile.style}

BOOST SCORES:
${scoresSummary}

TOP STRENGTH: ${topStrength.pillar} (${topStrength.score}/100)
PRIMARY GAP: ${primaryGap.pillar} (${primaryGap.score}/100)
RECOMMENDED PROGRAM: ${program}

PROFILE DEFINITIONS:
- Purple: Warm, Relational, Empathetic
- Gold: Analytical, Deliberate, Process-Driven
- Blue: Creative, Visionary, Big-Picture
- Red: Driver, Results-Focused, Direct

Write a personalized BOOST Blueprint Sales Assessment Report with these sections:

SECTION 1 — YOUR COLOR PROFILE
3-4 paragraphs on their ${personality.primaryProfile.name} primary profile. 2-3 paragraphs on their ${personality.secondaryProfile.name} secondary.

SECTION 2 — YOUR BOOST SCORE DASHBOARD
1-2 sentences per pillar score. Overall summary paragraph.

SECTION 3 — WHERE YOUR WIRING MEETS YOUR SKILL GAP
4-5 paragraphs on why their ${personality.primaryProfile.name} wiring creates their ${primaryGap.pillar} gap. Include a reframe.

SECTION 4 — THE BOOST BLUEPRINT
How to recognize and sell to each of the 4 profiles (Purple, Gold, Blue, Red).

SECTION 5 — YOUR PERSONALIZED PLAYBOOK
3 specific techniques for their ${personality.primaryProfile.name} profile to address their ${primaryGap.pillar} gap. 30-day action plan.

SECTION 6 — YOUR PROGRAM RECOMMENDATION
Why ${program} is right for them, framed for their ${personality.primaryProfile.name} profile.

SECTION 7 — YOUR NEXT STEP
Call to action for booking a strategy call at RealWiseAcademy.com.

Be specific, warm, direct, and professional. Write as if this was written personally for ${contact.fullName}.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const result = await response.json()
  console.log('Claude API response type:', result.type, 'content length:', result.content?.length)
  if (!result.content || !result.content[0]) {
    throw new Error('Claude API error: ' + JSON.stringify(result))
  }
  return result.content[0].text
}

function buildFallbackReport(data) {
  const { contact, personality, boostScores, program, primaryGap, topStrength } = data
  return `BOOST Blueprint Sales Assessment Report

Name: ${contact.fullName}
Primary Profile: ${personality.primaryProfile.name} — ${personality.primaryProfile.style}
Secondary Profile: ${personality.secondaryProfile.name} — ${personality.secondaryProfile.style}

BOOST SCORES:
${Object.values(boostScores).map(s => `${s.pillar}: ${s.score}/100 (${s.status})`).join('\n')}

Top Strength: ${topStrength.pillar} (${topStrength.score}/100)
Primary Gap: ${primaryGap.pillar} (${primaryGap.score}/100)
Recommended Program: ${program}

Your full personalized report will be sent to you shortly.
Book your strategy call at: https://realwiseacademy.com`
}

async function sendRespondentEmail(contact, reportText, data) {
  const { personality, boostScores, program, primaryGap, topStrength } = data
  const apiKey = process.env.EMAIL_OCTOPUS_API_KEY

  const scoreRows = Object.values(boostScores).map(s =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600">${s.pillarLetter} — ${s.pillar}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-weight:700;color:${s.status==='Strength'?'#1A7A4A':s.status==='Developing'?'#C8922A':'#E4181B'}">${s.score}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;color:${s.status==='Strength'?'#1A7A4A':s.status==='Developing'?'#C8922A':'#E4181B'}">${s.status}</td></tr>`
  ).join('')

  const reportHtml = reportText.split('\n').map(line => {
    if (line.startsWith('SECTION')) return `<h3 style="color:#E4181B;margin:24px 0 8px;font-size:16px">${line}</h3>`
    if (line.trim() === '') return '<br>'
    return `<p style="margin:0 0 12px;line-height:1.7">${line}</p>`
  }).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8f8f8;font-family:Arial,sans-serif">
<div style="max-width:680px;margin:0 auto;background:#fff">
  <div style="background:#1A1A1A;padding:24px 32px">
    <h1 style="color:#fff;margin:0;font-size:22px">THE BOOST BLUEPRINT</h1>
    <p style="color:#999;margin:4px 0 0;font-size:14px">Sales Assessment Report — RealWise Academy</p>
  </div>
  <div style="background:#E4181B;padding:16px 32px">
    <h2 style="color:#fff;margin:0;font-size:18px">Your Report is Ready, ${contact.fullName.split(' ')[0]}!</h2>
  </div>
  <div style="padding:28px 32px;background:#f8f8f8">
    <table width="100%" cellpadding="0" cellspacing="8">
      <tr>
        <td style="background:#6B3FA0;border-radius:8px;padding:12px;text-align:center;color:#fff;width:25%">
          <div style="font-size:11px;font-weight:700;opacity:.8">PRIMARY</div>
          <div style="font-size:18px;font-weight:800">${personality.primaryProfile.name}</div>
          <div style="font-size:11px;opacity:.8">${personality.primaryProfile.style}</div>
        </td>
        <td style="width:8px"></td>
        <td style="background:#C8922A;border-radius:8px;padding:12px;text-align:center;color:#fff;width:25%">
          <div style="font-size:11px;font-weight:700;opacity:.8">SECONDARY</div>
          <div style="font-size:18px;font-weight:800">${personality.secondaryProfile.name}</div>
          <div style="font-size:11px;opacity:.8">${personality.secondaryProfile.style}</div>
        </td>
        <td style="width:8px"></td>
        <td style="background:#1A7A4A;border-radius:8px;padding:12px;text-align:center;color:#fff;width:25%">
          <div style="font-size:11px;font-weight:700;opacity:.8">TOP STRENGTH</div>
          <div style="font-size:14px;font-weight:800">${topStrength.pillar}</div>
          <div style="font-size:11px;opacity:.8">Score: ${topStrength.score}</div>
        </td>
        <td style="width:8px"></td>
        <td style="background:#E4181B;border-radius:8px;padding:12px;text-align:center;color:#fff;width:25%">
          <div style="font-size:11px;font-weight:700;opacity:.8">PRIMARY GAP</div>
          <div style="font-size:14px;font-weight:800">${primaryGap.pillar}</div>
          <div style="font-size:11px;opacity:.8">Score: ${primaryGap.score}</div>
        </td>
      </tr>
    </table>
  </div>
  <div style="padding:0 32px 24px">
    <h3 style="font-size:14px;font-weight:700;color:#1A1A1A;text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Your BOOST Scores</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden">
      <tr style="background:#1A1A1A"><th style="padding:10px 12px;color:#fff;text-align:left;font-size:13px">Pillar</th><th style="padding:10px 12px;color:#fff;text-align:center;font-size:13px">Score</th><th style="padding:10px 12px;color:#fff;text-align:center;font-size:13px">Status</th></tr>
      ${scoreRows}
    </table>
  </div>
  <div style="padding:0 32px 32px;font-size:15px;line-height:1.7;color:#1A1A1A">${reportHtml}</div>
  <div style="margin:0 32px 32px;background:#1A1A1A;border-radius:12px;padding:28px 32px;text-align:center">
    <h3 style="color:#fff;font-size:20px;margin:0 0 8px">Ready to Build on This?</h3>
    <p style="color:#999;font-size:14px;margin:0 0 20px">Book a complimentary 30-minute Strategy Call with John Dessauer.</p>
    <a href="https://realwiseacademy.com/#programs" style="display:inline-block;background:#E4181B;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:16px">Book Your Strategy Call →</a>
  </div>
  <div style="padding:20px 32px;border-top:1px solid #eee;text-align:center">
    <p style="font-size:12px;color:#999;margin:0">© 2026 Dessauer Group II LLC. All Rights Reserved.<br>RealWise Academy | john@thedessauergroup.com</p>
  </div>
</div>
</body></html>`

  const payload = {
    api_key: apiKey,
    to: [{ email_address: contact.email, fields: { FirstName: contact.fullName.split(' ')[0] } }],
    from: { name: 'John Dessauer | RealWise Academy', email_address: 'john@thedessauergroup.com' },
    subject: `Your BOOST Blueprint Report is Ready, ${contact.fullName.split(' ')[0]}!`,
    content: { html },
  }

  const res = await fetch('https://emailoctopus.com/api/1.6/campaigns/transactional', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const result = await res.json()
  console.log('Email Octopus respondent response:', JSON.stringify(result).substring(0, 200))
}

async function sendOwnerEmail(contact, data) {
  const { personality, boostScores, program, primaryGap, topStrength, context } = data
  const apiKey = process.env.EMAIL_OCTOPUS_API_KEY
  const ownerEmail = process.env.OWNER_EMAIL
  const phone = contact.phone
  const telLink = `tel:${phone.replace(/\D/g, '')}`

  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:#1A1A1A;padding:20px;border-radius:8px 8px 0 0">
    <h2 style="color:#fff;margin:0">🎯 New Assessment Completed</h2>
    <p style="color:#999;margin:4px 0 0;font-size:13px">${new Date().toLocaleString()}</p>
  </div>
  <div style="background:#E4181B;padding:12px 20px">
    <h3 style="color:#fff;margin:0;font-size:16px">${contact.fullName} — ${personality.primaryProfile.name}/${personality.secondaryProfile.name} | Gap: ${primaryGap.pillar} (${primaryGap.score})</h3>
  </div>
  <div style="border:1px solid #eee;border-top:none;padding:20px;border-radius:0 0 8px 8px">
    <table cellpadding="6" cellspacing="0" width="100%">
      <tr><td style="font-weight:600;width:140px">Name:</td><td>${contact.fullName}</td></tr>
      <tr><td style="font-weight:600">Email:</td><td><a href="mailto:${contact.email}" style="color:#E4181B">${contact.email}</a></td></tr>
      <tr><td style="font-weight:600">Phone:</td><td><a href="${telLink}" style="color:#E4181B;font-size:18px;font-weight:700">📞 ${phone}</a></td></tr>
      <tr><td style="font-weight:600">Industry:</td><td>${context.industry || 'Not specified'}</td></tr>
      <tr><td style="font-weight:600">Role:</td><td>${context.role || 'Not specified'}</td></tr>
      <tr><td style="font-weight:600">Experience:</td><td>${context.experience || 'Not specified'}</td></tr>
    </table>
    <hr style="margin:16px 0;border:none;border-top:1px solid #eee">
    <table cellpadding="6" cellspacing="0" width="100%">
      <tr><td style="font-weight:600;width:160px">Primary Profile:</td><td style="color:#6B3FA0;font-weight:700">${personality.primaryProfile.name}</td></tr>
      <tr><td style="font-weight:600">Secondary:</td><td style="color:#C8922A;font-weight:700">${personality.secondaryProfile.name}</td></tr>
      <tr><td style="font-weight:600">Top Strength:</td><td style="color:#1A7A4A;font-weight:700">${topStrength.pillar} (${topStrength.score}/100)</td></tr>
      <tr><td style="font-weight:600">Primary Gap:</td><td style="color:#E4181B;font-weight:700">${primaryGap.pillar} (${primaryGap.score}/100)</td></tr>
      <tr><td style="font-weight:600">Program:</td><td><strong>${program}</strong></td></tr>
      <tr><td style="font-weight:600">Challenge:</td><td>${context.challenge || 'Not specified'}</td></tr>
      <tr><td style="font-weight:600">Goal:</td><td>${context.goal || 'Not specified'}</td></tr>
      <tr><td style="font-weight:600">Income Target:</td><td>${context.target_income || 'Not specified'}</td></tr>
    </table>
    <div style="margin-top:20px;text-align:center">
      <a href="${telLink}" style="display:inline-block;background:#E4181B;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:18px">📞 Call ${contact.fullName.split(' ')[0]} Now</a>
    </div>
  </div>
</body></html>`

  const res = await fetch('https://emailoctopus.com/api/1.6/campaigns/transactional', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      to: [{ email_address: ownerEmail }],
      from: { name: 'BOOST Assessment System', email_address: 'john@thedessauergroup.com' },
      subject: `🎯 New: ${contact.fullName} — ${personality.primaryProfile.name} | Gap: ${primaryGap.pillar}`,
      content: { html },
    }),
  })
  const result = await res.json()
  console.log('Email Octopus owner response:', JSON.stringify(result).substring(0, 200))
}

async function tagEmailOctopus(contact, personality, primaryGap, program) {
  const apiKey = process.env.EMAIL_OCTOPUS_API_KEY
  const listId = process.env.EMAIL_OCTOPUS_LIST_ID

  await fetch(`https://emailoctopus.com/api/1.6/lists/${listId}/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      email_address: contact.email,
      fields: {
        FirstName: contact.fullName.split(' ')[0],
        LastName: contact.fullName.split(' ').slice(1).join(' '),
        Phone: contact.phone,
      },
      tags: [
        'boost-assessment-completed',
        `profile-${personality.primaryProfile.name.toLowerCase()}`,
        `gap-${primaryGap.pillar.toLowerCase().replace(/ /g, '-')}`,
        `program-${program.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`,
      ],
      status: 'SUBSCRIBED',
    }),
  })
}

export const config = { path: '/api/submit-assessment' }
