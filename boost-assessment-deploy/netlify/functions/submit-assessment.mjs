import Stripe from 'stripe'
import { calculatePersonalityProfile, calculateBoostScores, getProgramRecommendation, profileLabels } from '../../src/config.js'

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const body = await req.json()
  const { contact, paymentIntent, rankings, ratings, context } = body

  // ── Verify payment ──────────────────────────────────────────────────────────
  const stripe = new Stripe(Netlify.env.get('STRIPE_SECRET_KEY'))
  try {
    const session = await stripe.checkout.sessions.retrieve(paymentIntent)
    if (session.payment_status !== 'paid') {
      return new Response(JSON.stringify({ ok: false, error: 'Payment not verified.' }), {
        status: 402, headers: { 'Content-Type': 'application/json' }
      })
    }
  } catch (err) {
    console.error('Payment verification error:', err)
    return new Response(JSON.stringify({ ok: false, error: 'Could not verify payment.' }), {
      status: 402, headers: { 'Content-Type': 'application/json' }
    })
  }

  // ── Score the assessment ────────────────────────────────────────────────────
  const personality = calculatePersonalityProfile(rankings)
  const boostScores = calculateBoostScores(ratings)
  const program = getProgramRecommendation(boostScores, context)

  // Find primary gap (lowest score) and top strength (highest score)
  const scoreEntries = Object.values(boostScores)
  const primaryGap = scoreEntries.reduce((a, b) => a.score < b.score ? a : b)
  const topStrength = scoreEntries.reduce((a, b) => a.score > b.score ? a : b)

  const assessmentData = {
    contact,
    personality,
    boostScores,
    program,
    primaryGap,
    topStrength,
    context,
    timestamp: new Date().toISOString(),
  }

  // ── Generate report via Claude API ─────────────────────────────────────────
  let reportText = ''
  try {
    reportText = await generateReport(assessmentData)
  } catch (err) {
    console.error('Report generation error:', err)
    reportText = buildFallbackReport(assessmentData)
  }

  // ── Send emails ─────────────────────────────────────────────────────────────
  await Promise.all([
    sendRespondentEmail(contact, reportText, assessmentData),
    sendOwnerEmail(contact, assessmentData),
    tagEmailOctopus(contact, personality, primaryGap, program),
  ])

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
}

// ── Claude API report generation ──────────────────────────────────────────────
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
- Income Target: ${context.target_income || 'Not specified'}

PERSONALITY PROFILE:
- Primary Profile: ${personality.primaryProfile.name} (Column ${personality.primary}) — ${personality.primaryProfile.style}
- Secondary Profile: ${personality.secondaryProfile.name} (Column ${personality.secondary}) — ${personality.secondaryProfile.style}
- Column Totals: A=${personality.totals.A}, B=${personality.totals.B}, C=${personality.totals.C}, D=${personality.totals.D}

BOOST PILLAR SCORES:
${scoresSummary}

TOP STRENGTH: ${topStrength.pillar} (${topStrength.score}/100)
PRIMARY GAP: ${primaryGap.pillar} (${primaryGap.score}/100)
RECOMMENDED PROGRAM: ${program}

PROFILE DEFINITIONS:
- Purple (Column A): Warm, Relational, Empathetic, Harmony-Seeking
- Gold (Column B): Analytical, Deliberate, Process-Driven, Detail-Oriented
- Blue (Column C): Creative, Visionary, Big-Picture, Transformative
- Red (Column D): Driver, Results-Focused, Direct, Competitive, Urgency-Driven

Generate a comprehensive, personalized BOOST Blueprint Sales Assessment Report with these 7 sections:

SECTION 1 — YOUR COLOR PROFILE
Write 3-4 paragraphs about their ${personality.primaryProfile.name} primary profile — who they are as a seller, their natural strengths, blind spots, and how prospects experience them. Then write 2-3 paragraphs about their ${personality.secondaryProfile.name} secondary profile including its strengths, blind spots, and how it interacts with their primary.

SECTION 2 — YOUR BOOST SCORE DASHBOARD
Briefly describe each pillar score (1-2 sentences each) and what it means for their specific sales situation in ${context.industry || 'their industry'}. Include an overall summary paragraph.

SECTION 3 — WHERE YOUR WIRING MEETS YOUR SKILL GAP (PRIMARY)
Write 4-5 paragraphs diagnosing exactly why their ${personality.primaryProfile.name} wiring is creating their ${primaryGap.pillar} gap. Be specific, insightful, and grounded in neuroscience and sales psychology. Include a reframe that changes how they think about this gap.

SECTION 3B — SECONDARY DIAGNOSIS
Write 3-4 paragraphs on how their ${personality.secondaryProfile.name} secondary profile affects their other developing pillars. Be specific to their scores.

SECTION 4 — THE BOOST BLUEPRINT
Explain how to recognize and sell to each of the 4 profile types (Purple, Gold, Blue, Red) with specific adaptations for someone with their ${personality.primaryProfile.name} primary profile selling in ${context.industry || 'their industry'}.

SECTION 5 — YOUR PERSONALIZED PLAYBOOK
Provide 3 specific, actionable techniques designed for their ${personality.primaryProfile.name} profile to address their ${primaryGap.pillar} gap. Include a 30-day action plan with 4 weekly focus areas.

SECTION 6 — YOUR PROGRAM RECOMMENDATION
Explain why ${program} is the right program for them specifically, using language and framing calibrated to their ${personality.primaryProfile.name} profile. Include what the program journey looks like for them.

SECTION 7 — YOUR NEXT STEP
Write a compelling, personalized call to action for booking a strategy call with John Dessauer at RealWise Academy.

Write in a warm, direct, professional tone. Be specific to their profile, scores, industry, and goals. Avoid generic language. This report should feel like it was written specifically for ${contact.fullName}.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Netlify.env.get('ANTHROPIC_API_KEY'),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const result = await response.json()
  return result.content[0].text
}

// ── Fallback report if Claude API fails ───────────────────────────────────────
function buildFallbackReport(data) {
  const { contact, personality, boostScores, program, primaryGap, topStrength } = data
  return `BOOST Blueprint Sales Assessment Report for ${contact.fullName}

Primary Profile: ${personality.primaryProfile.name} (${personality.primaryProfile.style})
Secondary Profile: ${personality.secondaryProfile.name} (${personality.secondaryProfile.style})

BOOST Scores:
${Object.values(boostScores).map(s => `${s.pillar}: ${s.score}/100 (${s.status})`).join('\n')}

Top Strength: ${topStrength.pillar} (${topStrength.score}/100)
Primary Gap: ${primaryGap.pillar} (${primaryGap.score}/100)
Recommended Program: ${program}

Your full personalized report is being prepared and will be sent shortly.
Book your strategy call at: https://realwiseacademy.com`
}

// ── Send respondent email via Email Octopus transactional ─────────────────────
async function sendRespondentEmail(contact, reportText, data) {
  const { personality, boostScores, program, primaryGap, topStrength } = data
  const apiKey = Netlify.env.get('EMAIL_OCTOPUS_API_KEY')

  const scoreRows = Object.values(boostScores).map(s =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600">${s.pillarLetter} — ${s.pillar}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-weight:700;color:${s.status==='Strength'?'#1A7A4A':s.status==='Developing'?'#C8922A':'#E4181B'}">${s.score}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;color:${s.status==='Strength'?'#1A7A4A':s.status==='Developing'?'#C8922A':'#E4181B'}">${s.status}</td></tr>`
  ).join('')

  const reportHtml = reportText
    .replace(/\n\n/g, '</p><p>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>')
    .replace(/SECTION \d+[AB]? — /g, '<h3 style="color:#E4181B;margin:24px 0 8px">')
    .replace(/\n/g, '<br>')

  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f8f8;font-family:Inter,Arial,sans-serif">
<div style="max-width:680px;margin:0 auto;background:#fff">
  <!-- Header -->
  <div style="background:#1A1A1A;padding:24px 32px">
    <h1 style="color:#fff;margin:0;font-size:22px">THE BOOST BLUEPRINT</h1>
    <p style="color:#999;margin:4px 0 0;font-size:14px">Sales Assessment Report — RealWise Academy</p>
  </div>
  <!-- Red bar -->
  <div style="background:#E4181B;padding:16px 32px">
    <h2 style="color:#fff;margin:0;font-size:18px">Your Personalized Report is Ready, ${contact.fullName.split(' ')[0]}!</h2>
  </div>
  <!-- Profile snapshot -->
  <div style="padding:28px 32px;background:#f8f8f8">
    <table width="100%" cellpadding="0" cellspacing="8">
      <tr>
        <td style="background:#6B3FA0;border-radius:8px;padding:12px;text-align:center;color:#fff;width:25%">
          <div style="font-size:11px;font-weight:700;opacity:.8">PRIMARY</div>
          <div style="font-size:20px;font-weight:800">${personality.primaryProfile.name}</div>
          <div style="font-size:11px;opacity:.8">${personality.primaryProfile.style}</div>
        </td>
        <td style="width:8px"></td>
        <td style="background:#C8922A;border-radius:8px;padding:12px;text-align:center;color:#fff;width:25%">
          <div style="font-size:11px;font-weight:700;opacity:.8">SECONDARY</div>
          <div style="font-size:20px;font-weight:800">${personality.secondaryProfile.name}</div>
          <div style="font-size:11px;opacity:.8">${personality.secondaryProfile.style}</div>
        </td>
        <td style="width:8px"></td>
        <td style="background:#1A7A4A;border-radius:8px;padding:12px;text-align:center;color:#fff;width:25%">
          <div style="font-size:11px;font-weight:700;opacity:.8">TOP STRENGTH</div>
          <div style="font-size:16px;font-weight:800">${topStrength.pillar}</div>
          <div style="font-size:11px;opacity:.8">Score: ${topStrength.score}</div>
        </td>
        <td style="width:8px"></td>
        <td style="background:#E4181B;border-radius:8px;padding:12px;text-align:center;color:#fff;width:25%">
          <div style="font-size:11px;font-weight:700;opacity:.8">PRIMARY GAP</div>
          <div style="font-size:16px;font-weight:800">${primaryGap.pillar}</div>
          <div style="font-size:11px;opacity:.8">Score: ${primaryGap.score}</div>
        </td>
      </tr>
    </table>
  </div>
  <!-- Score table -->
  <div style="padding:0 32px 24px">
    <h3 style="font-size:14px;font-weight:700;color:#1A1A1A;text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Your BOOST Scores</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden">
      <tr style="background:#1A1A1A"><th style="padding:10px 12px;color:#fff;text-align:left;font-size:13px">Pillar</th><th style="padding:10px 12px;color:#fff;text-align:center;font-size:13px">Score</th><th style="padding:10px 12px;color:#fff;text-align:center;font-size:13px">Status</th></tr>
      ${scoreRows}
    </table>
  </div>
  <!-- Report content -->
  <div style="padding:0 32px 32px;font-size:15px;line-height:1.7;color:#1A1A1A">
    ${reportHtml}
  </div>
  <!-- CTA -->
  <div style="margin:0 32px 32px;background:#1A1A1A;border-radius:12px;padding:28px 32px;text-align:center">
    <h3 style="color:#fff;font-size:20px;margin:0 0 8px">Ready to Build on This?</h3>
    <p style="color:#999;font-size:14px;margin:0 0 20px">Book a complimentary 30-minute Strategy Call with John Dessauer.</p>
    <a href="https://realwiseacademy.com/#programs" style="display:inline-block;background:#E4181B;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:16px">Book Your Strategy Call →</a>
  </div>
  <!-- Footer -->
  <div style="padding:20px 32px;border-top:1px solid #eee;text-align:center">
    <p style="font-size:12px;color:#999;margin:0">© 2026 Dessauer Group II LLC. All Rights Reserved.<br>RealWise Academy | john@thedessauergroup.com</p>
  </div>
</div>
</body></html>`

  try {
    await fetch('https://emailoctopus.com/api/1.6/campaigns/transactional', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        to: [{ email_address: contact.email, fields: { FirstName: contact.fullName.split(' ')[0] } }],
        from: { name: 'John Dessauer | RealWise Academy', email_address: 'john@thedessauergroup.com' },
        subject: `Your BOOST Blueprint Report is Ready, ${contact.fullName.split(' ')[0]}!`,
        content: { html },
      }),
    })
  } catch (err) {
    console.error('Respondent email error:', err)
  }
}

// ── Send owner notification email ─────────────────────────────────────────────
async function sendOwnerEmail(contact, data) {
  const { personality, boostScores, program, primaryGap, topStrength, context } = data
  const apiKey = Netlify.env.get('EMAIL_OCTOPUS_API_KEY')
  const ownerEmail = Netlify.env.get('OWNER_EMAIL')

  const phone = contact.phone
  const telLink = `tel:${phone.replace(/\D/g, '')}`

  const scoresSummary = Object.values(boostScores).map(s =>
    `${s.pillarLetter} — ${s.pillar}: ${s.score}/100 (${s.status})`
  ).join('<br>')

  const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:#1A1A1A;padding:20px;border-radius:8px 8px 0 0">
    <h2 style="color:#fff;margin:0">🎯 New Assessment Completed</h2>
    <p style="color:#999;margin:4px 0 0;font-size:13px">${new Date().toLocaleString()}</p>
  </div>
  <div style="background:#E4181B;padding:12px 20px">
    <h3 style="color:#fff;margin:0;font-size:16px">${contact.fullName} — ${personality.primaryProfile.name}/${personality.secondaryProfile.name} | Gap: ${primaryGap.pillar} (${primaryGap.score})</h3>
  </div>
  <div style="border:1px solid #eee;border-top:none;padding:20px;border-radius:0 0 8px 8px">
    <h3 style="margin:0 0 12px;font-size:15px;color:#1A1A1A">Contact Information</h3>
    <table cellpadding="6" cellspacing="0" width="100%">
      <tr><td style="font-weight:600;width:140px">Name:</td><td>${contact.fullName}</td></tr>
      <tr><td style="font-weight:600">Email:</td><td><a href="mailto:${contact.email}" style="color:#E4181B">${contact.email}</a></td></tr>
      <tr><td style="font-weight:600">Phone:</td><td><a href="${telLink}" style="color:#E4181B;font-size:18px;font-weight:700">📞 ${phone}</a></td></tr>
      <tr><td style="font-weight:600">Industry:</td><td>${context.industry || 'Not specified'}</td></tr>
      <tr><td style="font-weight:600">Role:</td><td>${context.role || 'Not specified'}</td></tr>
      <tr><td style="font-weight:600">Experience:</td><td>${context.experience || 'Not specified'}</td></tr>
    </table>
    <hr style="margin:16px 0;border:none;border-top:1px solid #eee">
    <h3 style="margin:0 0 12px;font-size:15px">Assessment Results</h3>
    <table cellpadding="6" cellspacing="0" width="100%">
      <tr><td style="font-weight:600;width:160px">Primary Profile:</td><td style="color:#6B3FA0;font-weight:700">${personality.primaryProfile.name} — ${personality.primaryProfile.style}</td></tr>
      <tr><td style="font-weight:600">Secondary Profile:</td><td style="color:#C8922A;font-weight:700">${personality.secondaryProfile.name} — ${personality.secondaryProfile.style}</td></tr>
      <tr><td style="font-weight:600">Top Strength:</td><td style="color:#1A7A4A;font-weight:700">${topStrength.pillar} (${topStrength.score}/100)</td></tr>
      <tr><td style="font-weight:600">Primary Gap:</td><td style="color:#E4181B;font-weight:700">${primaryGap.pillar} (${primaryGap.score}/100)</td></tr>
      <tr><td style="font-weight:600">Program Routed:</td><td><strong>${program}</strong></td></tr>
    </table>
    <hr style="margin:16px 0;border:none;border-top:1px solid #eee">
    <h3 style="margin:0 0 12px;font-size:15px">BOOST Scores</h3>
    <p style="font-size:14px;line-height:1.8">${scoresSummary}</p>
    <hr style="margin:16px 0;border:none;border-top:1px solid #eee">
    <h3 style="margin:0 0 12px;font-size:15px">Their Goals</h3>
    <table cellpadding="6" cellspacing="0" width="100%">
      <tr><td style="font-weight:600;width:160px">Challenge:</td><td>${context.challenge || 'Not specified'}</td></tr>
      <tr><td style="font-weight:600">Goal:</td><td>${context.goal || 'Not specified'}</td></tr>
      <tr><td style="font-weight:600">Income Target:</td><td>${context.target_income || 'Not specified'}</td></tr>
      <tr><td style="font-weight:600">How they heard:</td><td>${context.referral || 'Not specified'}</td></tr>
    </table>
    <div style="margin-top:20px;text-align:center">
      <a href="${telLink}" style="display:inline-block;background:#E4181B;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:18px">📞 Call ${contact.fullName.split(' ')[0]} Now</a>
    </div>
  </div>
</body></html>`

  try {
    await fetch('https://emailoctopus.com/api/1.6/campaigns/transactional', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        to: [{ email_address: ownerEmail }],
        from: { name: 'BOOST Assessment System', email_address: 'john@thedessauergroup.com' },
        subject: `🎯 New Assessment: ${contact.fullName} — ${personality.primaryProfile.name}/${personality.secondaryProfile.name} | Gap: ${primaryGap.pillar}`,
        content: { html },
      }),
    })
  } catch (err) {
    console.error('Owner email error:', err)
  }
}

// ── Tag respondent in Email Octopus ──────────────────────────────────────────
async function tagEmailOctopus(contact, personality, primaryGap, program) {
  const apiKey = Netlify.env.get('EMAIL_OCTOPUS_API_KEY')
  const listId = Netlify.env.get('EMAIL_OCTOPUS_LIST_ID')

  try {
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
          `gap-${primaryGap.pillar.toLowerCase().replace(' ', '-')}`,
          `program-${program.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`,
        ],
        status: 'SUBSCRIBED',
      }),
    })
  } catch (err) {
    console.error('Email Octopus tag error:', err)
  }
}

export const config = { path: '/api/submit-assessment' }
