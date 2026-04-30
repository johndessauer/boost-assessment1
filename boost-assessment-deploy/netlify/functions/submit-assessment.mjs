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
    } catch (err) { console.error('Payment error:', err.message) }
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
    
    // Determine effective role for report personalization
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
- Column Totals: Purple=${personality.totals.A}, Gold=${personality.totals.B}, Blue=${personality.totals.C}, Red=${personality.totals.D}

BOOST SCORES (0-100 scale):
- Build Trust: ${boostScores.build_trust.score} (${boostScores.build_trust.status})
- Observe: ${boostScores.observe.score} (${boostScores.observe.status})
- Offer: ${boostScores.offer.score} (${boostScores.offer.status})
- Secure: ${boostScores.secure.score} (${boostScores.secure.status})
- Track: ${boostScores.track.score} (${boostScores.track.status})

PRIMARY GAP: ${primaryGap.pillar} (${primaryGap.score})
TOP STRENGTH: ${topStrength.pillar} (${topStrength.score})

RECOMMENDED PROGRAM: ${program}

---

WRITING INSTRUCTIONS (CRITICAL):
You are writing a 20–25 page personalized strategic report. The tone is professional, data-driven, and supportive. The goal is to help this person understand their sales personality and BOOST skill gaps, teach them how to sell to different personality types, and position them to book a strategy call with RealWise Academy.

DO NOT use markdown (no # symbols, ** bold markers, or --- dividers). Use plain text only. Each section heading should start with "SECTION X --" on its own line, exactly as shown below.

Write these 13 sections (2–4 paragraphs each, except where noted):

SECTION 1 -- YOUR COLOR PROFILE: THE ${personality.primaryProfile.name.toUpperCase()} PERSONALITY
Explain what it means to be a ${personality.primaryProfile.name} in sales. Use specific traits from their profile. Reference their secondary color and how it modifies their primary style. Make it personal and affirming. Example: "As a ${personality.primaryProfile.name}, you bring [specific strengths] to every sales interaction. Your secondary ${personality.secondaryProfile.name} personality adds [modifier]." Ground this in research about personality types and sales performance.

SECTION 2 -- UNDERSTANDING THE OTHER THREE COLORS
Briefly describe Purple, Gold, Blue, and Red personalities (whichever three are not primary). For each, explain: How they make decisions, what they value, what stresses them, and how they buy. Keep it practical and memorable. This section should feel like a quick reference guide. Make it 3–4 paragraphs.

SECTION 3 -- DEFINING YOUR SCORES: WHAT STRENGTH, DEVELOPING, AND GAP MEAN
Explain the scoring system clearly. Define: A Strength is 80+ (you excel here consistently), Developing is 60–79 (you're building the skill, but inconsistently), and a Gap is below 60 (this skill needs focused development). Make it clear that all three are normal and fixable. Tie this to the neuroscience: gaps often reflect habits, not talent. Reference John Dessauer's principle that "sales is a learnable, teachable skill."

SECTION 4 -- YOUR BOOST SCORE DASHBOARD: THE FIVE PILLARS EXPLAINED
Walk through each of the five BOOST pillars one by one:
- Build Trust (oxytocin-driven rapport)
- Observe (discovery and needs analysis)
- Offer (solution tailoring)
- Secure (closing and objection handling)
- Track (performance metrics and continuous improvement)

For each pillar, give: the score, the status, what that means, and a brief science-backed explanation of why it matters. Use research citations from John Dessauer's BOOST book (neuroscience, psychology, sales data). Make this section 4–5 paragraphs, very data-focused.

SECTION 5 -- WHERE YOUR WIRING MEETS YOUR SKILL GAP: YOUR PERSONALITY + YOUR PRIMARY GAP
Connect their ${personality.primaryProfile.name} personality to their primary gap (${primaryGap.pillar}). Explain why ${personality.primaryProfile.name} personalities often struggle with ${primaryGap.pillar} (use specific reasoning). Example: "As a ${personality.primaryProfile.name}, you excel at building genuine connection—but that strength can sometimes mean you spend more time building rapport than moving to the close (Secure). This is a common pattern for your personality type." Make it validating and actionable. Reference research on personality-skill intersections.

SECTION 6 -- YOUR BOOST BLUEPRINT: HOW TO SELL ACROSS ALL FIVE PILLARS AS A ${personality.primaryProfile.name.toUpperCase()}
Provide principles (not detailed tactics) for how a ${personality.primaryProfile.name} should approach each BOOST pillar:
- Build Trust: [principles for your color]
- Observe: [principles for your color]
- Offer: [principles for your color]
- Secure: [principles for your color]
- Track: [principles for your color]

For each, explain the principle and WHY it works for ${personality.primaryProfile.name} personalities. Then end with: "To develop mastery in this pillar, you'll work through [specific topic] in our coaching program. Here's what's possible when you do..." Make this 4–5 paragraphs, focusing on principles and direction to coaching.

SECTION 7 -- SELLING TO THE OTHER THREE COLORS: YOUR COMPETITIVE EDGE
Teach them how to identify and adapt to the other three colors. For each color (not theirs), explain:
- The first signal you'll see (how to read them in 60 seconds)
- What they want (their buying motivations)
- Your move (how to adapt your approach as a ${personality.primaryProfile.name})

Make this a practical toolkit they can use immediately. Use the "Reading Someone in 60 Seconds" framework from the BOOST book. This section should feel like an unfair advantage. Make it 3–4 paragraphs.

SECTION 8 -- THE SCIENCE BEHIND BOOST: WHY THIS SYSTEM WORKS
Ground BOOST in neuroscience and research. Explain: oxytocin (trust), dopamine (anticipation and reward), cortisol (urgency and stress). Reference specific studies from the BOOST book: 
- 95% of purchasing decisions are subconscious (Zaltman, Harvard)
- Trust increases perceived competence by 50% (PLOS ONE)
- Science-based selling produces 35% higher close rates (HBR 2024)
- 57% of reps miss quota annually; training closes that gap (Salesforce 2024)

Make this compelling and make it clear: BOOST is not theory—it's backed by decades of research and billions in real-world sales. This section should reinforce credibility. Make it 2–3 paragraphs.

SECTION 9 -- YOUR PERSONALIZED PLAYBOOK: THE THREE BEHAVIORAL SHIFTS THAT WILL MOVE YOUR NEEDLE
Based on their ${personality.primaryProfile.name} profile and their gaps, give three specific behavioral shifts they can start implementing immediately:
1. [First shift, tied to personality and gap]
2. [Second shift, tied to personality and gap]
3. [Third shift, tied to personality and gap]

For each, explain: What to do, why it matters for your personality, and what result to expect. Make this actionable and motivating. This is the "how" they start getting better right now. Make it 3–4 paragraphs.

SECTION 10 -- WHY COACHING IS THE MULTIPLIER
Reference the research: Training alone produces 1-in-5 behavior change. Training + structured coaching produces 4x greater behavior change (HBR 2024). Explain why: because habits are hard to break alone, because you need someone to challenge your assumptions, because you need feedback in real time. Position coaching not as an expense but as the vehicle that converts knowledge into results. Make it 2 paragraphs.

SECTION 11 -- YOUR RECOMMENDED PROGRAM
Name the program recommended based on their role, team size, and gaps: either 1-Hour Consulting, 10-Pack Consulting, Yearly Consulting, BOOST Group & Team Sales Coaching, or BOOST CSO Strategic Overhaul. Explain WHY this program is the right fit for them specifically. Reference their gaps, their role, their team size, and their challenges. Make this feel like it was designed for them. Make it 2–3 paragraphs.

SECTION 12 -- WHAT SUCCESS LOOKS LIKE: THE 90-DAY VIEW
Paint a picture of what becomes possible when they close their primary gap and build mastery in BOOST. Include: improved close rates, stronger relationships, increased referrals, higher confidence, clearer positioning with prospects. Make it specific to their personality and their gap. Make it aspirational but believable. This is the destination. Make it 2 paragraphs.

SECTION 13 -- YOUR NEXT STEP: BOOK YOUR STRATEGY CALL
Make a clear, direct call to action. Give them the URL to book: www.realwiseacademy.com. Tell them what to expect: a 30-minute complimentary strategy call with John Dessauer to discuss their assessment results, clarify which program is the best fit, and map out their next 90 days. Tell them the call will be specific to their color, their gaps, and their situation. End with something like: "Your sales potential is not a mystery. It's a science. And it's waiting for you to unlock it. Let's go."

---

TONE:
- Professional, data-driven, supportive, and confident.
- Affirm their strengths while being honest about their gaps.
- Make it feel like a strategic advisor's analysis, not a generic report.
- Heavy on research and neuroscience.
- Every section should feel personal and specific to their situation.
- No fluff. Every sentence should earn its place.

LENGTH:
- This is a 20–25 page report. You have room to breathe. Use it. Each section should be substantial.

REMEMBER:
- You are selling them on their potential and positioning RealWise Academy as the vehicle to unlock it.
- The goal is to get them to book a strategy call.
- They paid $97 for this assessment. Deliver $97 of value in the first read, and millions of dollars of possibility in the action they take.

Now write the report. Start with SECTION 1.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 6000, messages: [{ role: 'user', content: prompt }] }),
    })
    const result = await response.json()
    console.log('Claude type:', result.type, '| stop:', result.stop_reason)
    reportText = (result.content && result.content[0]) ? result.content[0].text : ''
    if (!reportText) console.error('No report text:', JSON.stringify(result).substring(0, 300))
    else console.log('Report generated, chars:', reportText.length)
  } catch (err) {
    console.error('Report generation error:', err.message)
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
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY },
      body: JSON.stringify({ from: 'John Dessauer | RealWise Academy <john@thedessauergroup.com>', to: [contact.email], subject: 'Your BOOST Blueprint Report is Ready, ' + contact.fullName.split(' ')[0] + '!', html }),
    })
    const emailResult = await res.json()
    console.log('Respondent email:', JSON.stringify(emailResult).substring(0, 200))
  } catch (err) { console.error('Respondent email error:', err.message) }

  try {
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
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY },
      body: JSON.stringify({ from: 'BOOST Assessment <john@thedessauergroup.com>', to: [process.env.OWNER_EMAIL], subject: 'New Assessment: ' + contact.fullName + ' | ' + personality.primaryProfile.name + ' | Gap: ' + primaryGap.pillar, html: ownerHtml }),
    })
    const ownerResult = await res.json()
    console.log('Owner email:', JSON.stringify(ownerResult).substring(0, 200))
  } catch (err) { console.error('Owner email error:', err.message) }

  try {
    await fetch('https://emailoctopus.com/api/1.6/lists/' + process.env.EMAIL_OCTOPUS_LIST_ID + '/contacts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: process.env.EMAIL_OCTOPUS_API_KEY, email_address: contact.email, fields: { FirstName: contact.fullName.split(' ')[0], LastName: contact.fullName.split(' ').slice(1).join(' '), Phone: contact.phone }, tags: ['boost-assessment-completed', 'profile-' + personality.primaryProfile.name.toLowerCase(), 'gap-' + primaryGap.pillar.toLowerCase().replace(/ /g, '-')], status: 'SUBSCRIBED' }),
    })
    console.log('Email Octopus tagged successfully')
  } catch (err) { console.error('Email Octopus error:', err.message) }

  return okResponse
}
