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

async function callClaudeWithRetry(prompt, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'x-api-key': process.env.ANTHROPIC_API_KEY, 
          'anthropic-version': '2023-06-01' 
        },
        body: JSON.stringify({ 
          model: 'claude-opus-4-20250514', 
          max_tokens: 5000,
          messages: [{ role: 'user', content: prompt }] 
        }),
      })
      
      const result = await response.json()
      
      if (response.status === 529 || (result.error && result.error.type === 'overloaded_error')) {
        console.log(`Attempt ${attempt}/${maxAttempts}: Claude API overloaded. Retrying in ${Math.pow(2, attempt)}s...`)
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
          continue
        }
        throw new Error('Claude API overloaded after ' + maxAttempts + ' attempts')
      }
      
      if (!response.ok) {
        throw new Error('Claude API error: ' + response.status + ' ' + JSON.stringify(result))
      }
      
      return result
    } catch (err) {
      console.error(`Attempt ${attempt}/${maxAttempts} failed:`, err.message)
      if (attempt === maxAttempts) throw err
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
    }
  }
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
  
  console.log('Profile:', personality.primaryProfile.name, '| Gap:', primaryGap.pillar, '| Program:', program)

  // Generate report
  let reportText = ''
  try {
    let effectiveRole = context.role
    if (context.role === 'Entrepreneur') {
      if (context.business_structure === 'No, just me') {
        effectiveRole = 'Individual Sales Rep'
      } else {
        effectiveRole = 'Business Owner'
      }
    }

    const prompt = `You are creating a comprehensive, personalized BOOST Blueprint Sales Assessment Report for ${contact.fullName}.

RESPONDENT PROFILE:
- Full Name: ${contact.fullName}
- Email: ${contact.email}
- Role: ${effectiveRole}
- Industry: ${context.industry || 'Sales'}
- Years in Sales: ${context.experience || 'Not specified'}
- Team Size: ${context.team_size || 'Solo'}

COLOR PERSONALITY PROFILE:
- Primary Color: ${personality.primaryProfile.name} (${personality.primaryProfile.style})
- Secondary Color: ${personality.secondaryProfile.name} (${personality.secondaryProfile.style})

BOOST SCORES:
- Build Trust: ${boostScores.build_trust.score} (${boostScores.build_trust.status})
- Observe: ${boostScores.observe.score} (${boostScores.observe.status})
- Offer: ${boostScores.offer.score} (${boostScores.offer.status})
- Secure: ${boostScores.secure.score} (${boostScores.secure.status})
- Track: ${boostScores.track.score} (${boostScores.track.status})

PRIMARY GAP: ${primaryGap.pillar} (${primaryGap.score})
TOP STRENGTH: ${topStrength.pillar} (${topStrength.score})
RECOMMENDED PROGRAM: ${program}

---

WRITING INSTRUCTIONS:
You are writing a comprehensive 20–25 page personalized BOOST Blueprint Sales Assessment Report. Be professional, data-driven, and supportive. Help them understand their personality, gaps, and how to sell to other types. Position RealWise Academy as their vehicle to unlock their potential.

DO NOT use markdown. Each section heading: "SECTION X --" on its own line.

Write these 13 sections (3-4 paragraphs each):

SECTION 1 -- YOUR COLOR PROFILE: THE ${personality.primaryProfile.name.toUpperCase()} PERSONALITY
Explain what it means to be a ${personality.primaryProfile.name} in sales. Reference their secondary ${personality.secondaryProfile.name} and how it modifies their style. Ground in personality-sales research. Make it personal and affirming.

SECTION 2 -- UNDERSTANDING THE OTHER THREE COLORS
Quick reference guide for the three colors not their primary. For each: how they decide, what they value, what stresses them, how they buy. Practical and memorable.

SECTION 3 -- DEFINING YOUR SCORES
Strength = 80+ (consistent mastery). Developing = 60–79 (building skill). Gap = below 60 (needs focus). All normal and fixable. Gaps reflect habits, not talent. Sales is learnable.

SECTION 4 -- YOUR BOOST SCORE DASHBOARD
Walk through each pillar with score, status, and science. Build Trust (${boostScores.build_trust.score}): oxytocin-driven rapport. Observe (${boostScores.observe.score}): discovery and needs analysis. Offer (${boostScores.offer.score}): solution tailoring. Secure (${boostScores.secure.score}): closing and objection handling. Track (${boostScores.track.score}): performance metrics. Cite BOOST research. 4-5 paragraphs, very data-focused.

SECTION 5 -- WHERE YOUR WIRING MEETS YOUR GAP: ${personality.primaryProfile.name.toUpperCase()} + ${primaryGap.pillar.toUpperCase()}
Connect their ${personality.primaryProfile.name} personality to their ${primaryGap.pillar} gap. Explain why ${personality.primaryProfile.name} personalities often struggle with this. Example: "As a ${personality.primaryProfile.name}, your strength in X can become a weakness when Y." Validating and actionable. Reference personality-gap research.

SECTION 6 -- YOUR BOOST BLUEPRINT: SELLING AS A ${personality.primaryProfile.name.toUpperCase()}
Provide principles for each pillar: Build Trust, Observe, Offer, Secure, Track. For each: principle + why it works for their color. "To develop mastery, you'll work through [topic]. Here's what's possible when you do..." 4-5 paragraphs.

SECTION 7 -- SELLING TO THE OTHER THREE COLORS: YOUR COMPETITIVE EDGE
For each color (not theirs): (1) First signal to read them in 60 seconds, (2) What they want, (3) Your adaptive move as a ${personality.primaryProfile.name}. Practical toolkit they can use immediately. 3-4 paragraphs.

SECTION 8 -- THE SCIENCE BEHIND BOOST: WHY THIS SYSTEM WORKS
Ground in neuroscience: oxytocin (trust), dopamine (reward), cortisol (urgency). Key research: 95% of decisions are subconscious (Zaltman, Harvard). Trust increases competence by 50% (PLOS ONE). Science-based selling = 35% higher close rates (HBR 2024). 57% miss quota; training closes gap (Salesforce 2024). BOOST is research-backed. 2-3 paragraphs.

SECTION 9 -- YOUR PERSONALIZED PLAYBOOK: THREE BEHAVIORAL SHIFTS
Three specific shifts tied to their personality and ${primaryGap.pillar} gap:
1. [First shift + why it matters + expected result]
2. [Second shift + why it matters + expected result]
3. [Third shift + why it matters + expected result]
When you execute these, you'll [results]. 3-4 paragraphs.

SECTION 10 -- WHY COACHING IS THE MULTIPLIER
Training alone = 1-in-5 behavior change. Training + coaching = 4x greater change (HBR 2024). Why: habits hard to break alone, need real-time feedback, need assumption-challenging. Coaching converts knowledge into results. 2 paragraphs.

SECTION 11 -- YOUR RECOMMENDED PROGRAM
${program} is recommended because: [specific gaps], [their role], [team size]. This program is designed specifically for them. Reference their gaps, role, team size. 2-3 paragraphs.

SECTION 12 -- WHAT SUCCESS LOOKS LIKE: THE 90-DAY VIEW
Paint a picture of closing their ${primaryGap.pillar} gap and building BOOST mastery. Include: improved close rates, stronger relationships, more referrals, higher confidence, clearer positioning. Specific to their personality and gap. Aspirational but believable. 2 paragraphs.

SECTION 13 -- YOUR NEXT STEP: BOOK YOUR STRATEGY CALL
Clear CTA: Book at www.realwiseacademy.com. 30-minute call with John Dessauer. Discuss results, clarify program fit, map 90 days. Specific to their color, gaps, situation. End: "Your potential is not a mystery. It's a science. And it's waiting for you to unlock it. Let's go."

---

TONE: Professional, data-driven, supportive. Affirm strengths, be honest about gaps. Heavy on research and neuroscience. Every stat and strategy should have measurable outcomes. No fluff.

LENGTH: 20–25 pages. You have room to breathe. Use it.

Now write the full report. Start with SECTION 1.`

    const result = await callClaudeWithRetry(prompt)
    reportText = (result.content && result.content[0]) ? result.content[0].text : ''
    
    if (!reportText) {
      throw new Error('Claude returned empty response')
    }

    console.log(`Report generated: ${reportText.length} characters`)
  } catch (err) {
    console.error('Report generation error:', err.message)
    reportText = 'BOOST Blueprint Report for ' + contact.fullName + '\n\nProfile: ' + personality.primaryProfile.name + ' | Gap: ' + primaryGap.pillar + ' | Program: ' + program + '\n\nBook your strategy call: https://realwiseacademy.com'
  }

  // Build email HTML
  const scoreRows = Object.values(boostScores).map(s =>
    '<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600">' + s.pillar + '</td>'
    + '<td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-weight:700;color:' + (s.status==='Strength'?'#1A7A4A':s.status==='Developing'?'#C8922A':'#E4181B') + '">' + s.score + '</td>'
    + '<td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;color:' + (s.status==='Strength'?'#1A7A4A':s.status==='Developing'?'#C8922A':'#E4181B') + '">' + s.status + '</td></tr>'
  ).join('')

  const reportHtml = cleanReportHtml(reportText)
  const html = '<!DOCTYPE html><html><head><meta name="color-scheme" content="light"></head><body style="margin:0;padding:0;background:#f8f8f8;font-family:Arial,sans-serif">'
    + '<div style="max-width:680px;margin:0 auto;background:#fff">'
    + '<div style="background:#1A1A1A;padding:24px 32px"><h1 style="color:#fff;margin:0">THE BOOST BLUEPRINT</h1><p style="color:#999;margin:4px 0 0;font-size:14px">Sales Assessment Report -- RealWise Academy</p></div>'
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
    const resend = (await import('resend')).default
    const resendClient = new resend(process.env.RESEND_API_KEY)
    
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
    const resend = (await import('resend')).default
    const resendClient = new resend(process.env.RESEND_API_KEY)
    
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
