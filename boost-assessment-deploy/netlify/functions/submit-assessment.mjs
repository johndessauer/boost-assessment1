const profileLabels = {
  A: { name: 'Purple', style: 'Warm / Relational' },
  B: { name: 'Gold',   style: 'Analytical / Deliberate' },
  C: { name: 'Blue',   style: 'Visionary / Creative' },
  D: { name: 'Red',    style: 'Driver / Results-Focused' },
}

const skillSections = [
  { id: 'build_trust', pillar: 'Build Trust', pillarLetter: 'B' },
  { id: 'observe',     pillar: 'Observe',     pillarLetter: 'O' },
  { id: 'offer',       pillar: 'Offer',       pillarLetter: 'O' },
  { id: 'secure',      pillar: 'Secure',      pillarLetter: 'S' },
  { id: 'track',       pillar: 'Track',       pillarLetter: 'T' },
]

function calculatePersonalityProfile(rankings) {
  const totals = { A: 0, B: 0, C: 0, D: 0 }
  rankings.forEach(row => { totals.A += Number(row.A); totals.B += Number(row.B); totals.C += Number(row.C); totals.D += Number(row.D) })
  const sorted = Object.entries(totals).sort((a, b) => a[1] - b[1])
  return { totals, primary: sorted[0][0], secondary: sorted[1][0], primaryProfile: profileLabels[sorted[0][0]], secondaryProfile: profileLabels[sorted[1][0]] }
}

function calculateBoostScores(ratings) {
  const scores = {}
  skillSections.forEach(section => {
    const raw = ratings[section.id].reduce((sum, val) => sum + Number(val), 0)
    const score = Math.round(((raw - 4) / 16) * 100)
    const status = score >= 80 ? 'Strength' : score >= 60 ? 'Developing' : 'Gap'
    scores[section.id] = { raw, score, status, pillar: section.pillar, pillarLetter: section.pillarLetter }
  })
  return scores
}

function getProgramRecommendation(boostScores, context) {
  let effectiveRole = context.role
  if (context.role === 'Entrepreneur') {
    if (context.business_structure === 'No, just me') {
      effectiveRole = 'Individual Sales Rep'
    } else if (context.business_structure === 'Yes, I have a small team') {
      effectiveRole = 'Business Owner'
    }
  }
  const isTeam = ['Sales Manager', 'Business Owner'].includes(effectiveRole) || ['2–5','6–20','21–100','100+'].includes(context.team_size)
  if (isTeam && ['21–100','100+'].includes(context.team_size)) return 'BOOST CSO Strategic Overhaul'
  if (isTeam) return 'BOOST Group & Team Sales Coaching'
  const gaps = Object.values(boostScores).filter(s => s.status === 'Gap').length
  const developing = Object.values(boostScores).filter(s => s.status === 'Developing').length
  const experienced = ['6–10 years','11–20 years','20+ years'].includes(context.experience)
  if (gaps >= 3 || (experienced && gaps >= 1)) return 'Yearly Consulting'
  if (gaps >= 2 || developing >= 3) return '10-Pack Consulting'
  return '1-Hour Consulting'
}

function profileColor(key) {
  return key === 'A' ? '#6B3FA0' : key === 'B' ? '#C8922A' : key === 'C' ? '#1A6FB5' : '#C0392B'
}

function cleanReportHtml(text) {
  return text.split('\n').map(l => {
    l = l.replace(/^#{1,3}\s+/, '')
    l = l.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    if (l.trim() === '---' || l.trim() === '***') return ''
    if (l.startsWith('SECTION')) return '<h3 style="color:#E4181B;margin:24px 0 10px;font-weight:800;font-size:16px">' + l + '</h3>'
    if (!l.trim()) return '<br>'
    return '<p style="margin:0 0 10px;line-height:1.7">' + l + '</p>'
  }).join('')
}

async function callClaude(prompt, maxTokens = 1200) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 22000)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
      }),
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error('Claude API error: ' + response.status + ' ' + JSON.stringify(err))
    }

    const result = await response.json()
    return (result.content && result.content[0]) ? result.content[0].text : ''

  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      console.error('Claude call timed out after 22 seconds')
      throw new Error('Claude timeout')
    }
    throw err
  }
}

function buildFallbackPart1(contact, personality, boostScores, primaryGap, topStrength) {
  return `SECTION 1 -- YOUR ${personality.primaryProfile.name.toUpperCase()} PROFILE

You lead with ${personality.primaryProfile.name} energy — ${personality.primaryProfile.style}. Your secondary ${personality.secondaryProfile.name} adds depth to how you connect with clients.

SECTION 2 -- YOUR BOOST SCORE BREAKDOWN

Build Trust: ${boostScores.build_trust.score} (${boostScores.build_trust.status}) | Observe: ${boostScores.observe.score} (${boostScores.observe.status}) | Offer: ${boostScores.offer.score} (${boostScores.offer.status}) | Secure: ${boostScores.secure.score} (${boostScores.secure.status}) | Track: ${boostScores.track.score} (${boostScores.track.status})

SECTION 3 -- YOUR GAP: ${primaryGap.pillar.toUpperCase()}

${primaryGap.pillar} is your primary growth area at ${primaryGap.score}. This is where focused coaching will move the needle fastest.

SECTION 4 -- YOUR STRENGTH: ${topStrength.pillar.toUpperCase()}

${topStrength.pillar} is your top strength at ${topStrength.score}. This is your foundation — build your sales system around it.

SECTION 5 -- YOUR NEXT STEP

Book your strategy call at https://realwiseacademy.com/#programs to review these results with John Dessauer and map your first 90 days.`
}

function buildFallbackPart2(contact, personality, boostScores, primaryGap, topStrength, program, effectiveRole) {
  return `SECTION 6 -- YOUR BOOST BLUEPRINT: SELLING AS A ${personality.primaryProfile.name.toUpperCase()}

Your ${personality.primaryProfile.name} style gives you natural advantages in building rapport and creating trust. Use these strengths intentionally across all five BOOST pillars.

SECTION 7 -- SELLING TO THE OTHER THREE COLORS

Each personality type buys differently. Learn to read the signals in the first 60 seconds and adapt your approach to match what they need.

SECTION 8 -- THE SCIENCE BEHIND BOOST

BOOST is grounded in neuroscience. Oxytocin drives trust, dopamine drives decisions, and cortisol signals urgency. Research shows that 95% of buying decisions are subconscious (Zaltman, Harvard). Sales professionals who use science-based selling close 35% more (HBR 2024).

SECTION 9 -- YOUR PERSONALIZED PLAYBOOK

Three behavioral shifts tied to your ${primaryGap.pillar} gap will move your results in the next 90 days. Each shift is specific to your ${personality.primaryProfile.name} wiring and your role as a ${effectiveRole}.

SECTION 10 -- WHY COACHING IS THE MULTIPLIER

Training alone changes behavior 1 in 5 times. Training with coaching changes behavior 4 times more (HBR 2024). You need real-time feedback and accountability to convert knowledge into results.

SECTION 11 -- YOUR RECOMMENDED PROGRAM

${program} is the right fit based on your profile, gap, and role. This program is designed to close your ${primaryGap.pillar} gap and build lasting BOOST mastery.

SECTION 12 -- WHAT SUCCESS LOOKS LIKE: THE 90-DAY VIEW

In 90 days: stronger close rates, deeper client relationships, more referrals, and greater confidence in every sales conversation.

SECTION 13 -- YOUR NEXT STEP: BOOK YOUR STRATEGY CALL

Book at https://realwiseacademy.com/#programs. 30 minutes with John Dessauer. Review your results, confirm program fit, map your first 90 days. Your potential is not a mystery. It's a science. And it's waiting for you to unlock it. Let's go.`
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let body
  try { body = await req.json() } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid request' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const { contact, paymentIntent, rankings, ratings, context } = body
  console.log('Assessment received for:', contact?.email)

  // Verify payment
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (stripeKey && paymentIntent) {
    try {
      const authHeader = 'Basic ' + btoa(stripeKey + ':')
      const res = await fetch('https://api.stripe.com/v1/checkout/sessions/' + paymentIntent, { headers: { 'Authorization': authHeader } })
      const session = await res.json()
      console.log('Payment status:', session.payment_status)
      if (session.payment_status !== 'paid') {
        return new Response(JSON.stringify({ ok: false, error: 'Payment not verified.' }), { status: 402, headers: { 'Content-Type': 'application/json' } })
      }
    } catch (err) { console.error('Payment error:', err.message) }
  }

  // Calculate profile and scores
  const personality = calculatePersonalityProfile(rankings)
  const boostScores = calculateBoostScores(ratings)
  const program = getProgramRecommendation(boostScores, context)
  const scoreEntries = Object.values(boostScores)
  const primaryGap = scoreEntries.reduce((a, b) => a.score < b.score ? a : b)
  const topStrength = scoreEntries.reduce((a, b) => a.score > b.score ? a : b)
  const primaryColor = profileColor(personality.primary)
  const secondaryColor = profileColor(personality.secondary)

  let effectiveRole = context.role
  if (context.role === 'Entrepreneur') {
    effectiveRole = context.business_structure === 'No, just me' ? 'Individual Sales Rep' : 'Business Owner'
  }

  console.log('Profile:', personality.primaryProfile.name, '| Gap:', primaryGap.pillar, '| Program:', program)

  // --- PROMPT 1: Sections 1–5 ---
  const prompt1 = `Write sections 1–5 of a personalized BOOST Blueprint Sales Report for ${contact.fullName}. Professional, direct, data-driven. No markdown. Section headings: "SECTION X --"

RESPONDENT DATA:
- Name: ${contact.fullName} | Role: ${effectiveRole} | Industry: ${context.industry || 'Sales'} | Experience: ${context.experience || 'Not specified'}
- Primary Color: ${personality.primaryProfile.name} (${personality.primaryProfile.style})
- Secondary Color: ${personality.secondaryProfile.name} (${personality.secondaryProfile.style})
- Build Trust: ${boostScores.build_trust.score} (${boostScores.build_trust.status})
- Observe: ${boostScores.observe.score} (${boostScores.observe.status})
- Offer: ${boostScores.offer.score} (${boostScores.offer.status})
- Secure: ${boostScores.secure.score} (${boostScores.secure.status})
- Track: ${boostScores.track.score} (${boostScores.track.status})
- Primary Gap: ${primaryGap.pillar} (${primaryGap.score}) | Top Strength: ${topStrength.pillar} (${topStrength.score})

SECTION 1 -- YOUR ${personality.primaryProfile.name.toUpperCase()} PROFILE
What it means to sell as a ${personality.primaryProfile.name}. How the secondary ${personality.secondaryProfile.name} modifies their style. Affirming, grounded in personality-sales science. 2 paragraphs.

SECTION 2 -- UNDERSTANDING THE OTHER THREE COLORS
For each of the 3 non-primary colors: how they decide, what they value, what stresses them, how they buy. Quick-reference format. 2 paragraphs.

SECTION 3 -- DEFINING YOUR SCORES
Explain Strength (80+), Developing (60-79), Gap (below 60). Gaps reflect habits not talent. Sales is learnable. Normalize their results. 2 paragraphs.

SECTION 4 -- YOUR BOOST SCORE DASHBOARD
Walk through all 5 pillars: scores, status, one key insight per pillar. Reference BOOST research and neuroscience. 3 paragraphs.

SECTION 5 -- WHERE YOUR WIRING MEETS YOUR GAP: ${personality.primaryProfile.name.toUpperCase()} + ${primaryGap.pillar.toUpperCase()}
Why ${personality.primaryProfile.name} personalities often struggle with ${primaryGap.pillar}. Validate and give actionable direction. Reference personality-gap research. 2 paragraphs.

Keep each paragraph 4–6 sentences. Total: 500–600 words.`

  // --- PROMPT 2: Sections 6–13 ---
  const prompt2 = `Write sections 6–13 of a personalized BOOST Blueprint Sales Report for ${contact.fullName}. Professional, direct, data-driven. No markdown. Section headings: "SECTION X --"

RESPONDENT DATA:
- Name: ${contact.fullName} | Role: ${effectiveRole} | Experience: ${context.experience || 'Not specified'}
- Primary Color: ${personality.primaryProfile.name} (${personality.primaryProfile.style})
- Secondary Color: ${personality.secondaryProfile.name} (${personality.secondaryProfile.style})
- Primary Gap: ${primaryGap.pillar} (${primaryGap.score}) | Top Strength: ${topStrength.pillar} (${topStrength.score})
- Recommended Program: ${program}
- All BOOST Scores: Build Trust ${boostScores.build_trust.score}, Observe ${boostScores.observe.score}, Offer ${boostScores.offer.score}, Secure ${boostScores.secure.score}, Track ${boostScores.track.score}

SECTION 6 -- YOUR BOOST BLUEPRINT: SELLING AS A ${personality.primaryProfile.name.toUpperCase()}
One principle per pillar (Build Trust, Observe, Offer, Secure, Track) tailored to ${personality.primaryProfile.name} style. Why each works for their color. 2 paragraphs.

SECTION 7 -- SELLING TO THE OTHER THREE COLORS
For each non-primary color: (1) how to read them in 60 seconds, (2) what they want, (3) adaptive move as a ${personality.primaryProfile.name}. 2 paragraphs.

SECTION 8 -- THE SCIENCE BEHIND BOOST
Neuroscience: oxytocin (trust), dopamine (reward), cortisol (urgency). Key stats: 95% of decisions are subconscious (Zaltman, Harvard). Training + coaching = 4x behavior change (HBR 2024). 57% miss quota; coaching closes the gap. 2 paragraphs.

SECTION 9 -- YOUR PERSONALIZED PLAYBOOK: THREE BEHAVIORAL SHIFTS
Three specific shifts tied to their ${personality.primaryProfile.name} profile and ${primaryGap.pillar} gap. Each: shift + why it matters + expected result. 2 paragraphs.

SECTION 10 -- WHY COACHING IS THE MULTIPLIER
Training alone = 1-in-5 behavior change. Training + coaching = 4x (HBR 2024). Real-time feedback, habit breaking, accountability. 2 paragraphs.

SECTION 11 -- YOUR RECOMMENDED PROGRAM
Why ${program} fits their specific gaps, role (${effectiveRole}), and experience level. What they'll build in the program. 2 paragraphs.

SECTION 12 -- WHAT SUCCESS LOOKS LIKE: THE 90-DAY VIEW
Paint the picture: improved close rates, stronger relationships, more referrals, higher confidence. Specific to their personality and ${primaryGap.pillar} gap. 2 paragraphs.

SECTION 13 -- YOUR NEXT STEP: BOOK YOUR STRATEGY CALL
Book at https://realwiseacademy.com/#programs. 30-minute call with John Dessauer. What happens on the call. End with: "Your potential is not a mystery. It's a science. And it's waiting for you to unlock it. Let's go." 2 paragraphs.

Keep each paragraph 4–6 sentences. Total: 700–900 words.`

  // Run both Claude calls IN PARALLEL
  console.log('Starting parallel Claude calls...')
  const [part1Result, part2Result] = await Promise.allSettled([
    callClaude(prompt1, 1200),
    callClaude(prompt2, 1800),
  ])

  const part1Text = part1Result.status === 'fulfilled' && part1Result.value
    ? part1Result.value
    : buildFallbackPart1(contact, personality, boostScores, primaryGap, topStrength)

  const part2Text = part2Result.status === 'fulfilled' && part2Result.value
    ? part2Result.value
    : buildFallbackPart2(contact, personality, boostScores, primaryGap, topStrength, program, effectiveRole)

  if (part1Result.status === 'rejected') console.error('Part 1 failed:', part1Result.reason?.message)
  if (part2Result.status === 'rejected') console.error('Part 2 failed:', part2Result.reason?.message)

  const reportText = part1Text + '\n\n' + part2Text
  console.log('Report assembled:', reportText.length, 'chars')

  // Build email HTML
  const scoreRows = Object.values(boostScores).map(s =>
    '<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600">' + s.pillar + '</td>'
    + '<td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-weight:700;color:' + (s.status==='Strength'?'#1A7A4A':s.status==='Developing'?'#C8922A':'#E4181B') + '">' + s.score + '</td>'
    + '<td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;color:' + (s.status==='Strength'?'#1A7A4A':s.status==='Developing'?'#C8922A':'#E4181B') + '">' + s.status + '</td></tr>'
  ).join('')

  const reportHtml = cleanReportHtml(reportText)

  const html = '<!DOCTYPE html><html><head><meta name="color-scheme" content="light"></head><body style="margin:0;padding:0;background:#f8f8f8;font-family:Arial,sans-serif">'
    + '<div style="max-width:680px;margin:0 auto;background:#fff">'
    + '<div style="background:#1A1A1A;padding:24px 32px"><h1 style="color:#fff;margin:0">THE BOOST BLUEPRINT</h1><p style="color:#999;margin:4px 0 0;font-size:14px">Sales Assessment Report — RealWise Academy</p></div>'
    + '<div style="background:#1A5C38;padding:16px 32px"><h2 style="color:#fff;margin:0">Your Report is Ready, ' + contact.fullName.split(' ')[0] + '!</h2></div>'
    + '<div style="padding:24px 32px;background:#f8f8f8"><table width="100%" cellpadding="0" cellspacing="6"><tr>'
    + '<td style="background:' + primaryColor + ';border-radius:8px;padding:10px;text-align:center;color:#fff"><div style="font-size:10px;opacity:.8">PRIMARY</div><div style="font-size:16px;font-weight:800">' + personality.primaryProfile.name + '</div></td>'
    + '<td style="width:6px"></td>'
    + '<td style="background:' + secondaryColor + ';border-radius:8px;padding:10px;text-align:center;color:#fff"><div style="font-size:10px;opacity:.8">SECONDARY</div><div style="font-size:16px;font-weight:800">' + personality.secondaryProfile.name + '</div></td>'
    + '<td style="width:6px"></td>'
    + '<td style="background:#1A7A4A;border-radius:8px;padding:10px;text-align:center;color:#fff"><div style="font-size:10px;opacity:.8">TOP STRENGTH</div><div style="font-size:14px;font-weight:800">' + topStrength.pillar + ' (' + topStrength.score + ')</div></td>'
    + '<td style="width:6px"></td>'
    + '<td style="background:#E4181B;border-radius:8px;padding:10px;text-align:center;color:#fff"><div style="font-size:10px;opacity:.8">PRIMARY GAP</div><div style="font-size:14px;font-weight:800">' + primaryGap.pillar + ' (' + primaryGap.score + ')</div></td>'
    + '</tr></table></div>'
    + '<div style="padding:0 32px 24px"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden">'
    + '<tr style="background:#1A1A1A"><th style="padding:10px 12px;color:#fff;text-align:left">Pillar</th><th style="padding:10px 12px;color:#fff;text-align:center">Score</th><th style="padding:10px 12px;color:#fff;text-align:center">Status</th></tr>'
    + scoreRows + '</table></div>'
    + '<div style="padding:0 32px 32px;font-size:15px;color:#1A1A1A">' + reportHtml + '</div>'
    + '<div style="margin:0 32px 32px;background:#1A1A1A;border-radius:12px;padding:28px 32px;text-align:center">'
    + '<h3 style="color:#ffffff;margin:0 0 8px">Ready to Build on This?</h3>'
    + '<p style="color:#cccccc;font-size:14px;margin:0 0 20px">Book a complimentary 30-minute Strategy Call with John Dessauer.</p>'
    + '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table cellpadding="0" cellspacing="0"><tr><td style="background:#1A5C38;border-radius:8px"><a href="https://realwiseacademy.com/#programs" style="display:inline-block;background:#1A5C38;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-family:Arial,sans-serif">Book Your Strategy Call</a></td></tr></table></td></tr></table>'
    + '</div>'
    + '<div style="padding:20px 32px;border-top:1px solid #eee;text-align:center"><p style="font-size:12px;color:#999;margin:0">2026 Dessauer Group II LLC | RealWise Academy</p></div>'
    + '</div></body></html>'

  // Send respondent email
  try {
    const { Resend } = await import('resend')
    const resendClient = new Resend(process.env.RESEND_API_KEY)
    await resendClient.emails.send({
      from: 'John Dessauer | RealWise Academy <john@thedessauergroup.com>',
      to: contact.email,
      subject: `Your BOOST Blueprint Report is Ready, ${contact.fullName.split(' ')[0]}!`,
      html
    })
    console.log('Respondent email sent to:', contact.email)
  } catch (err) { console.error('Respondent email error:', err.message) }

  // Send owner email
  try {
    const telLink = 'tel:' + contact.phone.replace(/\D/g, '')
    const { Resend } = await import('resend')
    const resendClient = new Resend(process.env.RESEND_API_KEY)
    const ownerHtml = '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">'
      + '<div style="background:#1A1A1A;padding:20px;border-radius:8px 8px 0 0"><h2 style="color:#fff;margin:0">New Assessment: ' + contact.fullName + '</h2></div>'
      + '<div style="background:#E4181B;padding:12px 20px"><h3 style="color:#fff;margin:0">' + personality.primaryProfile.name + '/' + personality.secondaryProfile.name + ' | Gap: ' + primaryGap.pillar + '</h3></div>'
      + '<div style="border:1px solid #eee;border-top:none;padding:20px;border-radius:0 0 8px 8px">'
      + '<table cellpadding="6" cellspacing="0" width="100%">'
      + '<tr><td style="font-weight:600">Name:</td><td>' + contact.fullName + '</td></tr>'
      + '<tr><td style="font-weight:600">Email:</td><td><a href="mailto:' + contact.email + '" style="color:#E4181B">' + contact.email + '</a></td></tr>'
      + '<tr><td style="font-weight:600">Phone:</td><td><a href="' + telLink + '" style="color:#E4181B;font-weight:700">' + contact.phone + '</a></td></tr>'
      + '<tr><td style="font-weight:600">Role:</td><td>' + (context.role||'N/A') + '</td></tr>'
      + '<tr><td style="font-weight:600">Gap:</td><td style="color:#E4181B;font-weight:700">' + primaryGap.pillar + ' (' + primaryGap.score + ')</td></tr>'
      + '<tr><td style="font-weight:600">Program:</td><td><strong>' + program + '</strong></td></tr>'
      + '</table>'
      + '<div style="margin-top:20px;text-align:center"><a href="' + telLink + '" style="display:inline-block;background:#1A5C38;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:18px">Call ' + contact.fullName.split(' ')[0] + '</a></div>'
      + '</div></body></html>'
    await resendClient.emails.send({
      from: 'BOOST Assessment <john@thedessauergroup.com>',
      to: process.env.OWNER_EMAIL,
      subject: `New Assessment: ${contact.fullName} | ${personality.primaryProfile.name} | Gap: ${primaryGap.pillar}`,
      html: ownerHtml
    })
    console.log('Owner email sent')
  } catch (err) { console.error('Owner email error:', err.message) }

  // Tag in Email Octopus
  try {
    await fetch('https://emailoctopus.com/api/1.6/lists/' + process.env.EMAIL_OCTOPUS_LIST_ID + '/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.EMAIL_OCTOPUS_API_KEY,
        email_address: contact.email,
        fields: { FirstName: contact.fullName.split(' ')[0], LastName: contact.fullName.split(' ').slice(1).join(' '), Phone: contact.phone },
        tags: ['boost-assessment-completed', 'profile-' + personality.primaryProfile.name.toLowerCase(), 'gap-' + primaryGap.pillar.toLowerCase().replace(/ /g, '-')],
        status: 'SUBSCRIBED'
      })
    })
    console.log('Email Octopus tagged')
  } catch (err) { console.error('Email Octopus error:', err.message) }

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
}
