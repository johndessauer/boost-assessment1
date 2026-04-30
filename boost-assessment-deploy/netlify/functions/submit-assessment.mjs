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

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  let body
  try { body = await req.json() } catch (e) {
    console.error('JSON parse error:', e.message)
    return new Response(JSON.stringify({ ok: false, error: 'Invalid request' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const { contact, paymentIntent, rankings, ratings, context } = body
  console.log('Assessment received for:', contact?.email)

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
    } catch (err) { 
      console.error('Payment error:', err.message) 
    }
  }

  const personality = calculatePersonalityProfile(rankings)
  const boostScores = calculateBoostScores(ratings)
  const program = getProgramRecommendation(boostScores, context)
  const scoreEntries = Object.values(boostScores)
  const primaryGap = scoreEntries.reduce((a, b) => a.score < b.score ? a : b)
  const topStrength = scoreEntries.reduce((a, b) => a.score > b.score ? a : b)
  const primaryColor = profileColor(personality.primary)
  const secondaryColor = profileColor(personality.secondary)
  console.log('Profile:', personality.primaryProfile.name, '| Gap:', primaryGap.pillar, '| Program:', program)

  let reportText = ''
  try {
    const scores = Object.values(boostScores).map(s => s.pillar + ': ' + s.score + ' (' + s.status + ')').join(', ')
    
    let effectiveRole = context.role
    if (context.role === 'Entrepreneur') {
      if (context.business_structure === 'No, just me') {
        effectiveRole = 'Individual Sales Rep'
      } else {
        effectiveRole = 'Business Owner'
      }
    }

    const prompt = `You are creating a personalized BOOST Blueprint Sales Assessment Report for ${contact.fullName}.

RESPONDENT PROFILE:
- Name: ${contact.fullName}
- Role: ${effectiveRole}
- Industry: ${context.industry || 'Sales'}
- Experience: ${context.experience || 'Not specified'}
- Personality: ${personality.primaryProfile.name} (primary) / ${personality.secondaryProfile.name} (secondary)

BOOST SCORES:
${scores}

KEY METRICS:
- Top Strength: ${topStrength.pillar} (${topStrength.score})
- Primary Gap: ${primaryGap.pillar} (${primaryGap.score})
- Program Recommendation: ${program}

---

WRITE AN 8-SECTION PERSONALIZED REPORT (15-18 pages total):

SECTION 1: EXECUTIVE SUMMARY
Open with impact. You are a ${personality.primaryProfile.name}-${personality.secondaryProfile.name} hybrid - a rare combination. Your assessment reveals both tremendous potential and a critical gap costing you significant revenue. Estimate revenue impact of closing your primary gap (${primaryGap.pillar}). Make it personal, urgent, and hopeful. Use specific numbers and examples relevant to their industry.

SECTION 2: YOUR PERSONALITY BLUEPRINT
Explain what it means to be a ${personality.primaryProfile.name} with ${personality.secondaryProfile.name} secondary traits. Use neuroscience. Why do they sell the way they do? What are their natural superpowers? What blind spots come with this personality? Ground this in psychology and sales research.

SECTION 3: YOUR BOOST SCORECARD DECODED
Walk through each of the 5 BOOST pillars. For each: the score, what it means, real-world impact. Use concrete examples. Explain Strengths (80+), Developing (60-79), Gaps (below 60). This is their data dashboard - make it clear and actionable.

SECTION 4: YOUR PRIMARY GAP: ${primaryGap.pillar.toUpperCase()}
Deep dive into their biggest opportunity. Why does a ${personality.primaryProfile.name} personality typically struggle here? What does this gap cost them? (Use dollar amounts if possible.) What specific behaviors are creating this gap? What research backs up why this matters? Make it feel personal and fixable.

SECTION 5: YOUR TOP STRENGTH: ${topStrength.pillar.toUpperCase()}
Celebrate their superpower. How can they leverage this MORE? How does this strength mask or compensate for their gap? Stories or examples of how this strength shows up in their selling. Position this as a foundation to build on.

SECTION 6: SCIENCE-BACKED STRATEGIES TO CLOSE YOUR GAP
Provide 3-4 concrete, science-backed approaches to improving their ${primaryGap.pillar} score. Ground each in neuroscience or behavioral psychology. These should feel like strategic advice from a sales coach, not generic tips. Make them specific to their personality type and industry.

SECTION 7: YOUR 90-DAY IMPLEMENTATION ROADMAP
Paint a clear 30-60-90 day picture. What should they do in Month 1? Month 2? Month 3? What results should they expect to see? Include specific metrics. Make this feel achievable and exciting. Position the ${program} program as the vehicle to accelerate this roadmap.

SECTION 8: THE BUSINESS CASE & YOUR NEXT STEP
Show the math: what closing this gap is worth in annual revenue. Frame this as ROI, not cost. Then make a clear, compelling CTA: Book a complimentary 30-minute Strategy Call with John Dessauer at www.realwiseacademy.com. Tell them what to expect on that call. End with something inspirational that ties their potential to RealWise Academy's mission.

---

TONE & STYLE:
- Professional, data-driven, empowering
- Heavy on research and neuroscience
- Specific to their personality and situation (not generic)
- Affirm their strengths, honest about gaps
- Every sentence earns its place - no fluff
- Make them feel seen and understood

LENGTH:
This is a 15-18 page report. Each section should be 2-4 paragraphs of substance. You have room to breathe - use it for depth, not filler.

GOAL:
Sell them on their potential. Position RealWise Academy as the path to unlock it. Get them to book the strategy call.

Now write the report. Start with SECTION 1.`

    const apiKey = process.env.ANTHROPIC_API_KEY
    
    if (!apiKey) {
      console.error('CRITICAL: ANTHROPIC_API_KEY not set in environment variables')
      throw new Error('Missing ANTHROPIC_API_KEY')
    }

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
        max_tokens: 5000, 
        messages: [{ role: 'user', content: prompt }] 
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Claude API error:', response.status, errorText)
      throw new Error(`Claude API returned ${response.status}: ${errorText}`)
    }

    const result = await response.json()
    console.log('Claude response type:', result.type, '| stop reason:', result.stop_reason)
    
    if (result.error) {
      console.error('Claude error:', JSON.stringify(result.error))
      throw new Error(`Claude error: ${result.error.message}`)
    }

    reportText = (result.content && result.content[0]) ? result.content[0].text : ''
    if (!reportText) {
      console.error('No report text from Claude:', JSON.stringify(result).substring(0, 500))
      throw new Error('Claude returned empty response')
    }
    
    console.log('Report generated successfully, length:', reportText.length, 'chars')
    
  } catch (err) {
    console.error('CRITICAL - Report generation error:', err.message)
    reportText = 'BOOST Blueprint Report for ' + contact.fullName + '\n\nProfile: ' + personality.primaryProfile.name + ' | Gap: ' + primaryGap.pillar + ' | Program: ' + program + '\n\nBook your strategy call: https://realwiseacademy.com'
  }

  const scoreRows = Object.values(boostScores).map(s =>
    '<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600">' + s.pillar + '</td>'
    + '<td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-weight:700;color:' + (s.status==='Strength'?'#1A7A4A':s.status==='Developing'?'#C8922A':'#E4181B') + '">' + s.score + '</td>'
    + '<td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;color:' + (s.status==='Strength'?'#1A7A4A':s.status==='Developing'?'#C8922A':'#E4181B') + '">' + s.status + '</td></tr>'
  ).join('')

  const reportHtml = cleanReportHtml(reportText)

  const html = '<!DOCTYPE html><html><head><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head><body style="margin:0;padding:0;background:#f8f8f8;font-family:Arial,sans-serif">'
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
          subject: 'Your BOOST Blueprint Report is Ready, ' + contact.fullName.split(' ')[0] + '!', 
          html 
        }),
      })
      const emailResult = await res.json()
      console.log('Respondent email sent:', emailResult.id || emailResult.error || 'unknown result')
    }
  } catch (err) { 
    console.error('Respondent email error:', err.message) 
  }

  try {
    const resendKey = process.env.RESEND_API_KEY
    const ownerEmail = process.env.OWNER_EMAIL
    
    if (!resendKey) {
      console.error('RESEND_API_KEY not set for owner email')
    } else if (!ownerEmail) {
      console.error('OWNER_EMAIL not set')
    } else {
      const telLink = 'tel:' + contact.phone.replace(/\D/g, '')
      const ownerHtml = '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">'
        + '<div style="background:#1A1A1A;padding:20px;border-radius:8px 8px 0 0"><h2 style="color:#fff;margin:0">New Assessment: ' + contact.fullName + '</h2></div>'
        + '<div style="background:#E4181B;padding:12px 20px"><h3 style="color:#fff;margin:0">' + personality.primaryProfile.name + '/' + personality.secondaryProfile.name + ' | Gap: ' + primaryGap.pillar + ' (' + primaryGap.score + ')</h3></div>'
        + '<div style="border:1px solid #eee;border-top:none;padding:20px;border-radius:0 0 8px 8px">'
        + '<table cellpadding="6" cellspacing="0" width="100%">'
        + '<tr><td style="font-weight:600;width:130px">Name:</td><td>' + contact.fullName + '</td></tr>'
        + '<tr><td style="font-weight:600">Email:</td><td><a href="mailto:' + contact.email + '" style="color:#E4181B">' + contact.email + '</a></td></tr>'
        + '<tr><td style="font-weight:600">Phone:</td><td><a href="' + telLink + '" style="color:#E4181B;font-size:18px;font-weight:700">' + contact.phone + '</a></td></tr>'
        + '<tr><td style="font-weight:600">Industry:</td><td>' + (context.industry||'N/A') + '</td></tr>'
        + '<tr><td style="font-weight:600">Role:</td><td>' + (context.role||'N/A') + '</td></tr>'
        + '<tr><td style="font-weight:600">Gap:</td><td style="color:#E4181B;font-weight:700">' + primaryGap.pillar + ' (' + primaryGap.score + ')</td></tr>'
        + '<tr><td style="font-weight:600">Program:</td><td><strong>' + program + '</strong></td></tr>'
        + '</table>'
        + '<div style="margin-top:20px;text-align:center"><a href="' + telLink + '" style="display:inline-block;background:#1A5C38;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:18px">Call ' + contact.fullName.split(' ')[0] + ' Now</a></div>'
        + '</div></body></html>'

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + resendKey },
        body: JSON.stringify({ 
          from: 'BOOST Assessment <john@thedessauergroup.com>', 
          to: [ownerEmail], 
          subject: 'New Assessment: ' + contact.fullName + ' | ' + personality.primaryProfile.name + ' | Gap: ' + primaryGap.pillar, 
          html: ownerHtml 
        }),
      })
      const ownerResult = await res.json()
      console.log('Owner email sent:', ownerResult.id || ownerResult.error || 'unknown result')
    }
  } catch (err) { 
    console.error('Owner email error:', err.message) 
  }

  try {
    const listId = process.env.EMAIL_OCTOPUS_LIST_ID
    const apiKey = process.env.EMAIL_OCTOPUS_API_KEY
    
    if (!listId || !apiKey) {
      console.warn('Email Octopus credentials not fully set (LIST_ID or API_KEY missing)')
    } else {
      await fetch('https://emailoctopus.com/api/1.6/lists/' + listId + '/contacts', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          api_key: apiKey, 
          email_address: contact.email, 
          fields: { 
            FirstName: contact.fullName.split(' ')[0], 
            LastName: contact.fullName.split(' ').slice(1).join(' '), 
            Phone: contact.phone 
          }, 
          tags: ['boost-assessment-completed', 'profile-' + personality.primaryProfile.name.toLowerCase(), 'gap-' + primaryGap.pillar.toLowerCase().replace(/ /g, '-')], 
          status: 'SUBSCRIBED' 
        }),
      })
      console.log('Email Octopus tagged successfully')
    }
  } catch (err) { 
    console.error('Email Octopus error:', err.message) 
  }

  console.log('Assessment submission complete for:', contact.email)
  return okResponse
}
