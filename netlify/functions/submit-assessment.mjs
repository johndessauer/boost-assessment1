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
  const isTeam = ['Sales Manager', 'Business Owner'].includes(context.role) || ['2-5','6-20','21-100','100+'].includes(context.team_size)
  if (isTeam && ['21-100','100+'].includes(context.team_size)) return 'BOOST CSO Strategic Overhaul'
  if (isTeam) return 'BOOST Group & Team Sales Coaching'
  const gaps = Object.values(boostScores).filter(s => s.status === 'Gap').length
  const developing = Object.values(boostScores).filter(s => s.status === 'Developing').length
  const experienced = ['6-10 years','11-20 years','20+ years'].includes(context.experience)
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
    const prompt = 'Write a personalized BOOST Blueprint Sales Assessment Report for ' + contact.fullName + '.\n\n'
      + 'Profile: ' + personality.primaryProfile.name + ' (' + personality.primaryProfile.style + ') primary, ' + personality.secondaryProfile.name + ' secondary\n'
      + 'Industry: ' + (context.industry || 'Sales') + ' | Role: ' + (context.role || 'Sales Professional') + '\n'
      + 'Scores: ' + scores + '\n'
      + 'Top Strength: ' + topStrength.pillar + ' (' + topStrength.score + ') | Gap: ' + primaryGap.pillar + ' (' + primaryGap.score + ')\n'
      + 'Program: ' + program + '\n\n'
      + 'Profiles: Purple=Warm/Relational, Gold=Analytical, Blue=Visionary/Creative, Red=Driver/Results\n\n'
      + 'Write 7 sections (2-3 paragraphs each). IMPORTANT: Do NOT use any markdown — no # symbols, no ** bold markers, no --- dividers. Use plain text only. Start each section heading on its own line exactly like this:\n'
      + 'SECTION 1 — YOUR COLOR PROFILE\n'
      + 'SECTION 2 — YOUR BOOST SCORE DASHBOARD\n'
      + 'SECTION 3 — WHERE YOUR WIRING MEETS YOUR SKILL GAP\n'
      + 'SECTION 4 — THE BOOST BLUEPRINT\n'
      + 'SECTION 5 — YOUR PERSONALIZED PLAYBOOK\n'
      + 'SECTION 6 — YOUR PROGRAM RECOMMENDATION\n'
      + 'SECTION 7 — YOUR NEXT STEP (CTA to book at RealWiseAcademy.com)'

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
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
    + '</div>
