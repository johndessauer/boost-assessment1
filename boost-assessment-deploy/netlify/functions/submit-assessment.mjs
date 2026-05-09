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
    effectiveRole = (context.team_size === 'Just me') ? 'Individual Sales Rep' : 'Business Owner'
  }
  const isTeam = ['Sales Manager', 'Business Owner'].includes(effectiveRole) || ['2-5','6-20','21-100','100+'].includes(context.team_size)
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
        model: 'claude-haiku-4-5-20251001',
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
    if (err.name === 'AbortError') { console.error('Claude call timed out'); throw new Error('Claude timeout') }
    throw err
  }
}

function buildFallbackPart1(contact, personality, boostScores, primaryGap, topStrength) {
  return `SECTION 1 -- YOUR ${personality.primaryProfile.name.toUpperCase()} PROFILE
You lead with ${personality.primaryProfile.name} energy — ${personality.primaryProfile.style}. Your secondary ${personality.secondaryProfile.name} adds depth to how you connect with clients.

SECTION 2 -- UNDERSTANDING THE OTHER THREE COLORS
Each of the four BOOST colors buys differently. Reading the room in the first 60 seconds is one of the highest-leverage skills in the system.

SECTION 3 -- DEFINING YOUR SCORES
Gaps reflect learned habits, not talent. Sales is a learnable skill — and that means every score here can move.

SECTION 4 -- YOUR BOOST SCORE DASHBOARD
Build Trust: ${boostScores.build_trust.score} (${boostScores.build_trust.status}) | Observe: ${boostScores.observe.score} (${boostScores.observe.status}) | Offer: ${boostScores.offer.score} (${boostScores.offer.status}) | Secure: ${boostScores.secure.score} (${boostScores.secure.status}) | Track: ${boostScores.track.score} (${boostScores.track.status})

SECTION 5 -- WHERE YOUR WIRING MEETS YOUR GAP: ${personality.primaryProfile.name.toUpperCase()} + ${primaryGap.pillar.toUpperCase()}
Your ${personality.primaryProfile.name} wiring creates specific natural tendencies in how you approach ${primaryGap.pillar}. Understanding the connection between your color and your gap is the first step to closing it.`
}

function buildFallbackPart2(contact, personality, boostScores, primaryGap, topStrength, program, effectiveRole, currentIncome, targetIncome) {
  const roiLine = currentIncome && targetIncome
    ? `You are currently at ${currentIncome} with a target of ${targetIncome}. Closing your ${primaryGap.pillar} gap is the most direct path to that number. The Yearly Consulting program is $14,997 — a fraction of the income gap you are trying to close.`
    : `The Yearly Consulting program is $14,997. Based on the research, reps who close their primary BOOST gap consistently see 20–40% improvements in close rate — which means the program pays for itself many times over in year one.`

  return `SECTION 6 -- YOUR BOOST BLUEPRINT: SELLING AS A ${personality.primaryProfile.name.toUpperCase()}
Your ${personality.primaryProfile.name} style gives you natural advantages across the BOOST system. The key is deploying those strengths intentionally.

SECTION 7 -- SELLING TO THE OTHER THREE COLORS
Each color telegraphs itself in the first 60 seconds. Once you can read the room, you stop selling generically and start selling specifically.

SECTION 8 -- THE SCIENCE BEHIND BOOST
BOOST is grounded in neuroscience. Oxytocin drives trust, dopamine drives decisions, cortisol signals urgency. 95% of buying decisions are subconscious (Zaltman, Harvard). Science-based selling produces 35% higher close rates and 20% larger deals (HBR 2024).

SECTION 9 -- YOUR PERSONALIZED PLAYBOOK: THREE BEHAVIORAL SHIFTS
Three behavioral shifts tied to your ${personality.primaryProfile.name} profile and ${primaryGap.pillar} gap will move your results in the next 90 days.

SECTION 10 -- WHY COACHING IS THE MULTIPLIER
Training alone changes behavior in only 1 in 5 reps. Training with coaching produces 4x greater behavior change (HBR 2024).

SECTION 11 -- YOUR RECOMMENDED PROGRAM
${program} is the right fit based on your profile, gap, and role. ${roiLine}

SECTION 12 -- WHAT SUCCESS LOOKS LIKE: THE 90-DAY VIEW
In 90 days: stronger close rates, deeper client relationships, more referrals, and greater confidence in every sales conversation. Skills compound — every close funds the next opportunity.

SECTION 13 -- YOUR NEXT STEP: BOOK YOUR STRATEGY CALL
Book at https://realwiseacademy.com/#programs. 30 minutes with John Dessauer. Review your results, confirm program fit, map your first 90 days.

Your potential is not a mystery. It's a science. And it's waiting for you to unlock it. Let's go.`
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

  let effectiveRole = context.role
  if (context.role === 'Entrepreneur') {
    effectiveRole = (context.team_size === 'Just me') ? 'Individual Sales Rep' : 'Business Owner'
  }

  const currentIncome = context.income && context.income.trim() ? context.income.trim() : null
  const targetIncome = context.target_income && context.target_income.trim() ? context.target_income.trim() : null

  console.log('Profile:', personality.primaryProfile.name, '| Gap:', primaryGap.pillar, '| Program:', program)
  if (currentIncome) console.log('Income:', currentIncome, '→', targetIncome || 'no target')

  // --- PROMPT 1: Sections 1–5 ---
  const prompt1 = `You are generating sections 1–5 of a BOOST Blueprint Sales Assessment Report for ${contact.fullName}. This report is based on the BOOST Sales Success System created by John Dessauer of RealWise Academy. Write in second person, speaking directly to ${contact.fullName}. Professional, direct, warm but data-driven. No markdown. Section headings must be exactly: "SECTION X --"

CRITICAL RULE: ONLY 4 colors exist in the BOOST system: Purple, Gold, Blue, Red. Never reference Green, Orange, or any other color under any circumstances.

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

BOOST FRAMEWORK REFERENCE — THE FOUR COLORS (Dr. McCafferty Sales Personality Test, Chapter 16):

PURPLE: Values honesty above nearly everything. Driven by relationships, purpose, and making a difference. Highly sensitive to tone, subtext, and sincerity. Will bend over backward for a project or person they believe in. Measures success by harmony, growth in others, and integrity. Excellent communicators — they need connection, not transaction. They buy on trust and relationship. Stressed by: broken promises, insincerity, conflict, being treated as a number. First signal in the room: asks how your family is doing before asking about the product.

GOLD: Order, structure, and reliability are non-negotiable. "Be prepared" is their actual life motto. Detail-oriented and practical — they will read the fine print. Driven by tradition, stability, and doing things the right way. Financial responsibility and process mastery are how they measure success. They buy on process and proof. Stressed by: ambiguity, disorganization, people who don't follow through, changing details after an agreement. First signal in the room: shows up with a printed agenda and a list of questions.

BLUE: Problem-solving and intellectual mastery are their love languages. Competence is everything — being seen as incompetent is their greatest fear. Abstract thinkers who thrive on complexity and challenge. Motivated by the pursuit of knowledge, precision, and systems that work. They buy on logic and competence. Stressed by: incompetence in anyone they trust, emotional displays in professional settings, small talk, subjective judgments made without data. First signal in the room: immediately challenges a claim you made and wants proof.

RED: Adventure, action, and freedom are the three pillars of their existence. Charismatic natural leaders who attract people effortlessly. Master negotiators who are always ready for a deal. Competitive in everything — every conversation has a score. They measure success by really living, testing limits, and having a great story to tell. They buy on action and excitement. Stressed by: too much structure, redundancy, being micromanaged, lack of fun. First signal in the room: cuts you off mid-sentence to ask what the bottom line is.

BOOST PILLAR REFERENCE (BOOST: The Sales Success System by John Dessauer):
- Build Trust (B): Oxytocin is the neurochemical foundation of trust. Genuine warmth and presence trigger it — making prospects more open, cooperative, and willing to buy. Oxytocin also increases perceived competence: a prospect who trusts you thinks your solution is better before you describe it (PLOS ONE). Four pillars of likability: show up fully, mirror their energy, find the person before the prospect, be confident not loud. A 5% increase in retention produces a 25–95% profit increase (Bain).
- Observe (O): The discipline of understanding before you offer. Rackham's Huthwaite research across 35,000+ sales calls found discovery question quality is the single strongest predictor of close rate — more than charm, product knowledge, or presentation skills. Three levels of need: stated (surface), implicit (real driver), unknown (where great deals live). Silence is a sales tool. The rep who asks better questions beats the rep with the better pitch, every time.
- Offer (O): Stop selling. Start solving. Outcomes over features — dopamine fires on anticipation of reward, not on product descriptions. The Challenger Sale finding: highest performers teach prospects something new about their own situation before presenting a solution. McKinsey: companies excelling at personalization generate 40% more revenue. Recommend, don't menu — fewer options close more deals.
- Secure (S): The close is not the end of the sale — it is the beginning of the relationship. Five buying signals: budget queries, timeline questions, comparison requests, clarification probes, process questions. Trial closes improve close rates by 40% (Sales Management Journal, 2023). Six closing techniques: Assumptive, Option, Summary, Urgency, Direct, Suggestion. The 24-hour follow-up rule protects every close.
- Track (T): What you measure, you manage. What you manage, you improve. Six key metrics: lead-to-opportunity conversion, opportunity-to-close rate, average deal size, sales cycle length, referral rate, activity-to-outcome ratios. 57% of reps miss quota annually (Salesforce 2024) — the differentiator is measurement discipline, not talent. Data-driven teams grow revenue 20% faster (McKinsey 2024).

---

SECTION 1 -- YOUR ${personality.primaryProfile.name.toUpperCase()} PROFILE
Using the BOOST framework above, describe what it means to lead with ${personality.primaryProfile.name} energy in sales. Cover core traits, what drives this personality, and how they naturally show up in client interactions. Then explain how the secondary ${personality.secondaryProfile.name} color modifies their approach — where these two colors reinforce each other and where they create interesting tension. Be affirming and grounded. Speak directly to ${contact.fullName}. 2 paragraphs, 4–6 sentences each.

SECTION 2 -- UNDERSTANDING THE OTHER THREE COLORS
Using the Dr. McCafferty framework above, describe the three non-primary colors (${['Purple','Gold','Blue','Red'].filter(c => c !== personality.primaryProfile.name).join(', ')}). For each: how they make decisions, what they value most, what stresses them, and the first signal they give off in a room. Close with: once you can read the room in 60 seconds, you stop selling generically and start selling specifically. 2 paragraphs, 4–6 sentences each.

SECTION 3 -- DEFINING YOUR SCORES
Explain what Strength (80+), Developing (60–79), and Gap (below 60) mean in the BOOST system. Gaps reflect habits and learned patterns — not talent or ceiling. Ground this in John Dessauer's core belief: sales is a learnable, teachable skill. Fewer than 200 universities offer dedicated sales programs despite sales being 10% of the national workforce. Normalize ${contact.fullName}'s results warmly. 2 paragraphs, 4–6 sentences each.

SECTION 4 -- YOUR BOOST SCORE DASHBOARD
Walk through all 5 pillars: Build Trust (${boostScores.build_trust.score}, ${boostScores.build_trust.status}), Observe (${boostScores.observe.score}, ${boostScores.observe.status}), Offer (${boostScores.offer.score}, ${boostScores.offer.status}), Secure (${boostScores.secure.score}, ${boostScores.secure.status}), Track (${boostScores.track.score}, ${boostScores.track.status}). For each pillar: state the score and status, give one key insight from the BOOST framework, and reference the relevant research stat where it adds weight. Make it feel like a coaching conversation. 3 paragraphs, 4–6 sentences each.

SECTION 5 -- WHERE YOUR WIRING MEETS YOUR GAP: ${personality.primaryProfile.name.toUpperCase()} + ${primaryGap.pillar.toUpperCase()}
Explain the specific relationship between ${personality.primaryProfile.name} wiring and the ${primaryGap.pillar} pillar — what natural tendencies of this color create friction here. Be specific and validating, not critical. Then give ${contact.fullName} 2–3 concrete, actionable directions grounded in their ${personality.primaryProfile.name} wiring. Make it feel like a trusted advisor, not a report. 2 paragraphs, 4–6 sentences each.

Total target: 550–650 words.`

  // --- PROMPT 2: Sections 6–13 ---
  const incomeContext = currentIncome && targetIncome
    ? `- Current Annual Income/Revenue: ${currentIncome}\n- Target Income/Revenue (12 months): ${targetIncome}`
    : currentIncome
      ? `- Current Annual Income/Revenue: ${currentIncome}\n- Target Income/Revenue: Not provided`
      : `- Income: Not provided`

  const prompt2 = `You are generating sections 6–13 of a BOOST Blueprint Sales Assessment Report for ${contact.fullName}. This report is based on the BOOST Sales Success System created by John Dessauer of RealWise Academy. Write in second person, speaking directly to ${contact.fullName}. Professional, direct, warm but data-driven. No markdown. Section headings must be exactly: "SECTION X --"

CRITICAL RULE: ONLY 4 colors exist in the BOOST system: Purple, Gold, Blue, Red. Never reference Green, Orange, or any other color under any circumstances.

RESPONDENT DATA:
- Name: ${contact.fullName} | Role: ${effectiveRole} | Experience: ${context.experience || 'Not specified'}
- Primary Color: ${personality.primaryProfile.name} (${personality.primaryProfile.style})
- Secondary Color: ${personality.secondaryProfile.name} (${personality.secondaryProfile.style})
- Primary Gap: ${primaryGap.pillar} (${primaryGap.score}) | Top Strength: ${topStrength.pillar} (${topStrength.score})
- Recommended Program: ${program}
- All BOOST Scores: Build Trust ${boostScores.build_trust.score}, Observe ${boostScores.observe.score}, Offer ${boostScores.offer.score}, Secure ${boostScores.secure.score}, Track ${boostScores.track.score}
${incomeContext}

BOOST FRAMEWORK — SELLING AS AND TO EACH COLOR (Chapter 16):

SELLING AS PURPLE: Lead with the relationship, not the pitch. Be completely transparent — any hint of manipulation costs you the deal and the relationship. Show how your solution benefits people, not just the bottom line. Follow up with warmth. Do not rush the decision.

SELLING AS GOLD: Come prepared with documentation, data, and a clear process — winging it ends the meeting. Speak in specifics: numbers, timelines, deliverables. Show the track record. Slow and steady wins this race; pressuring them backfires every time.

SELLING AS BLUE: Know your product better than your prospect. Lead with data, logic, evidence — skip the emotional appeal. Let them ask deep questions; that means they are engaged. Give them time to think — they do not decide out loud. Praise their intelligence, not their personality.

SELLING AS RED: Get to the point fast. Make it exciting — energy is contagious, flatness is fatal. Give them options so they feel like they are choosing. Appeal to their competitive nature. Create genuine urgency.

SELLING TO PURPLE: Be real. Build the relationship first. They are not buying until they trust you. Do not rush them.
SELLING TO GOLD: Be prepared. Know your product cold. Do what you say every time. Speak in specifics.
SELLING TO BLUE: Match their intellect. Lead with evidence. Skip small talk. Give them space to think.
SELLING TO RED: Get to the point. Make it exciting and urgent. Give them freedom to choose. Match their energy.

BOOST PILLAR DYNAMICS:
- Build Trust: Oxytocin is the foundation. Trust increases perceived competence (PLOS ONE). 5% retention = 25–95% profit increase (Bain).
- Observe: Rackham (35,000+ calls): discovery question quality is the single strongest close rate predictor. Three levels of need: stated, implicit, unknown. Silence is a sales tool.
- Offer: Outcomes over features — dopamine fires on anticipation. Challenger Sale: teach before you pitch. Recommend, don't menu.
- Secure: Five buying signals. Trial closes improve close rates 40% (Sales Management Journal, 2023). Six techniques: Assumptive, Option, Summary, Urgency, Direct, Suggestion. 24-hour follow-up rule.
- Track: 57% miss quota — measurement discipline is the differentiator (Salesforce 2024). Data-driven teams grow revenue 20% faster (McKinsey 2024). High performers are 4.9x more likely to use CRM actively.

PROGRAM DESCRIPTIONS:
- 1-Hour Consulting: High-impact single session. For reps with few gaps needing targeted clarity.
- 10-Pack Consulting: Ten sessions of systematic coaching. For reps with 2+ gaps needing structured development.
- Yearly Consulting ($14,997): Full-year coaching relationship with John Dessauer. His flagship individual program. For experienced professionals or reps ready to compound results.
- BOOST Group & Team Sales Coaching: For Sales Managers and Business Owners with small teams.
- BOOST CSO Strategic Overhaul: For organizations with 21+ people.

ROI CALCULATION GUIDANCE — USE IN SECTION 11:
Build a personalized ROI case using the respondent's income data and their primary gap. Apply the research stat most relevant to their gap:
- Build Trust gap → "A 5% increase in client retention produces a 25–95% profit increase (Bain)."
- Observe gap → "Reps who master discovery question quality — the single strongest predictor of close rate (Rackham, 35,000+ calls) — consistently outperform peers. Improving close rate by 20% directly compounds income."
- Offer gap → "McKinsey research shows reps who excel at personalized solution presentation generate 40% more revenue."
- Secure gap → "Reps who master trial close techniques improve close rates by 40% (Sales Management Journal, 2023). Current income × 1.40 = projected income after closing this gap."
- Track gap → "Data-driven sales professionals grow revenue 20% faster than peers who operate on intuition alone (McKinsey 2024)."

If BOTH current and target income are provided: calculate the dollar gap between them. Apply the relevant research stat to show how closing the ${primaryGap.pillar} gap bridges that gap. Then position the $14,997 Yearly Consulting investment against the projected income increase and show the year-one ROI clearly. Example: "You are currently at $85,000 with a target of $150,000. That is a $65,000 gap. Reps who close their Secure gap improve close rates by 40% — on your current income base, that is an additional $34,000 in year one alone. The Yearly Consulting program is $14,997. That is a projected 2.3x return in year one before compounding."

If only current income is provided: use the relevant stat to project a dollar improvement without fabricating a target.
If no income data is provided: make the ROI case using research stats only — do not fabricate numbers.

---

SECTION 6 -- YOUR BOOST BLUEPRINT: SELLING AS A ${personality.primaryProfile.name.toUpperCase()}
One specific principle per pillar (Build Trust, Observe, Offer, Secure, Track) tailored to ${personality.primaryProfile.name} wiring. For each, explain why it works for this color. Ground in BOOST system language. 2 paragraphs, 4–6 sentences each.

SECTION 7 -- SELLING TO THE OTHER THREE COLORS
For each non-primary color (${['Purple','Gold','Blue','Red'].filter(c => c !== personality.primaryProfile.name).join(', ')}): how to read them in 60 seconds, what they need to move toward a decision, and the specific adaptive move a ${personality.primaryProfile.name} needs to make — including what natural tendencies of their own color to watch out for. 2 paragraphs, 4–6 sentences each.

SECTION 8 -- THE SCIENCE BEHIND BOOST
Neuroscience foundation: oxytocin drives trust and increases perceived competence (PLOS ONE); dopamine fires on anticipation of reward — outcomes beat features every time; cortisol signals real urgency. 95% of purchasing decisions are subconscious (Zaltman, Harvard). Science-based selling: 35% higher close rates, 20% larger deals (HBR 2024). Make this feel like conviction. 2 paragraphs, 4–6 sentences each.

SECTION 9 -- YOUR PERSONALIZED PLAYBOOK: THREE BEHAVIORAL SHIFTS
Three specific shifts tied to ${personality.primaryProfile.name} wiring and ${primaryGap.pillar} gap. For each: name the behavior change, explain why it matters for this specific color-gap combination, include a research stat that quantifies the expected result, and describe what changes. Immediately actionable. 2 paragraphs, 4–6 sentences each.

SECTION 10 -- WHY COACHING IS THE MULTIPLIER
Training alone changes behavior in 1 in 5 reps. Training + coaching = 4x behavior change (HBR 2024, LSA Global). Real-time feedback breaks ingrained habits. Explain why this matters specifically for ${contact.fullName}'s ${primaryGap.pillar} gap. Reference John Dessauer's direct coaching approach. 2 paragraphs, 4–6 sentences each.

SECTION 11 -- YOUR RECOMMENDED PROGRAM
Explain why ${program} fits ${contact.fullName} — reference their gap (${primaryGap.pillar} at ${primaryGap.score}), role (${effectiveRole}), and experience. Then build the personalized ROI case using the income data and ROI guidance above. Show the math clearly and specifically. This is a financial argument from a trusted advisor, not a sales pitch. 2 paragraphs, 4–6 sentences each.

SECTION 12 -- WHAT SUCCESS LOOKS LIKE: THE 90-DAY VIEW
Paint the 90-day picture: stronger close rates, deeper relationships, growing referral pipeline, greater confidence. ${targetIncome ? `Reference their target of ${targetIncome} directly — show the path from where they are to where they want to be.` : 'Make this specific to their personality strengths and gap closing.'} Skills compound — every close funds the next opportunity, every relationship generates referrals (John Dessauer). 2 paragraphs, 4–6 sentences each.

SECTION 13 -- YOUR NEXT STEP: BOOK YOUR STRATEGY CALL
Book at https://realwiseacademy.com/#programs. Describe the 30-minute call: review results, confirm program fit, map first 90 days. Open door, not a pressure close. End the entire report with this exact sentence on its own line: "Your potential is not a mystery. It's a science. And it's waiting for you to unlock it. Let's go." 2 paragraphs, 4–6 sentences each.

Total target: 800–950 words.`

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
    : buildFallbackPart2(contact, personality, boostScores, primaryGap, topStrength, program, effectiveRole, currentIncome, targetIncome)

  if (part1Result.status === 'rejected') console.error('Part 1 failed:', part1Result.reason?.message)
  if (part2Result.status === 'rejected') console.error('Part 2 failed:', part2Result.reason?.message)

  const reportText = part1Text + '\n\n' + part2Text
  console.log('Report assembled:', reportText.length, 'chars')

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
      + '<tr><td style="font-weight:600">Current Income:</td><td>' + (currentIncome || 'Not provided') + '</td></tr>'
      + '<tr><td style="font-weight:600">Target Income:</td><td>' + (targetIncome || 'Not provided') + '</td></tr>'
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
