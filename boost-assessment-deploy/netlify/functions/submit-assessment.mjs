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

SECTION 2 -- UNDERSTANDING THE OTHER THREE COLORS

Each of the four BOOST colors buys differently. Reading the room in the first 60 seconds — and adapting your approach — is one of the highest-leverage skills in the BOOST system.

SECTION 3 -- DEFINING YOUR SCORES

Build Trust: ${boostScores.build_trust.score} (${boostScores.build_trust.status}) | Observe: ${boostScores.observe.score} (${boostScores.observe.status}) | Offer: ${boostScores.offer.score} (${boostScores.offer.status}) | Secure: ${boostScores.secure.score} (${boostScores.secure.status}) | Track: ${boostScores.track.score} (${boostScores.track.status})

SECTION 4 -- YOUR BOOST SCORE DASHBOARD

${primaryGap.pillar} is your primary growth area at ${primaryGap.score}. ${topStrength.pillar} is your top strength at ${topStrength.score}. Gaps reflect learned habits, not talent. Sales is a learnable skill — and that means every score here can move.

SECTION 5 -- WHERE YOUR WIRING MEETS YOUR GAP: ${personality.primaryProfile.name.toUpperCase()} + ${primaryGap.pillar.toUpperCase()}

Your ${personality.primaryProfile.name} wiring creates specific natural tendencies in how you approach ${primaryGap.pillar}. Understanding the connection between your color and your gap is the first step to closing it.`
}

function buildFallbackPart2(contact, personality, boostScores, primaryGap, topStrength, program, effectiveRole) {
  return `SECTION 6 -- YOUR BOOST BLUEPRINT: SELLING AS A ${personality.primaryProfile.name.toUpperCase()}

Your ${personality.primaryProfile.name} style gives you natural advantages across the BOOST system. The key is deploying those strengths intentionally — and knowing where to compensate.

SECTION 7 -- SELLING TO THE OTHER THREE COLORS

Each color telegraphs itself in the first 60 seconds if you know what to look for. Once you can read the room, you stop selling generically and start selling specifically. That is when deals stop being a grind and start being a conversation.

SECTION 8 -- THE SCIENCE BEHIND BOOST

BOOST is grounded in neuroscience. Oxytocin drives trust, dopamine drives decisions, and cortisol signals urgency. Research shows that 95% of buying decisions are subconscious (Zaltman, Harvard). Science-based selling produces 35% higher close rates and 20% larger deals (HBR 2024).

SECTION 9 -- YOUR PERSONALIZED PLAYBOOK: THREE BEHAVIORAL SHIFTS

Three behavioral shifts tied to your ${personality.primaryProfile.name} profile and ${primaryGap.pillar} gap will move your results in the next 90 days. Each shift is specific to your wiring and your role as a ${effectiveRole}.

SECTION 10 -- WHY COACHING IS THE MULTIPLIER

Training alone changes behavior in only 1 in 5 reps. Training combined with structured coaching produces 4x greater behavior change (HBR 2024). You need real-time feedback and accountability to convert knowledge into results.

SECTION 11 -- YOUR RECOMMENDED PROGRAM

${program} is the right fit based on your profile, gap, and role. This program is designed to close your ${primaryGap.pillar} gap and build lasting BOOST mastery.

SECTION 12 -- WHAT SUCCESS LOOKS LIKE: THE 90-DAY VIEW

In 90 days: stronger close rates, deeper client relationships, more referrals, and greater confidence in every sales conversation. Skills compound — every additional close funds the next opportunity, every relationship generates referrals.

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

GOLD: Order, structure, and reliability are non-negotiable. "Be prepared" is their actual life motto. Detail-oriented and practical — they will read the fine print. Driven by tradition, stability, and doing things the right way. Financial responsibility and process mastery are how they measure success. They buy on process and proof. Stressed by: ambiguity, disorganization, people who don't follow through, changing details after an agreement is reached. First signal in the room: shows up with a printed agenda and a list of questions.

BLUE: Problem-solving and intellectual mastery are their love languages. Competence is everything — being seen as incompetent is their greatest fear. Abstract thinkers who thrive on complexity and challenge. Motivated by the pursuit of knowledge, precision, and systems that work. They buy on logic and competence. Stressed by: incompetence in anyone they trust, emotional displays in professional settings, small talk, subjective judgments made without data. First signal in the room: immediately challenges a claim you made and wants proof.

RED: Adventure, action, and freedom are the three pillars of their existence. Charismatic natural leaders who attract people effortlessly. Master negotiators who are always ready for a deal. Competitive in everything — every conversation has a score. They measure success by really living, testing limits, and having a great story to tell. They buy on action and excitement. Stressed by: too much structure, redundancy, being micromanaged, lack of fun. First signal in the room: cuts you off mid-sentence to ask what the bottom line is.

BOOST PILLAR REFERENCE (BOOST: The Sales Success System by John Dessauer):
- Build Trust (B): Grounded in neuroscience — oxytocin is the neurochemical foundation of trust. Genuine warmth and presence trigger it in the prospect's brain, making them more open, cooperative, and willing to buy. Oxytocin also increases perceived competence — a prospect who trusts you thinks your solution is better before you even describe it (PLOS ONE). Four pillars of likability: show up fully (phone away, full presence), mirror their energy, find the person before the prospect, be confident not loud. A 5% increase in retention produces a 25–95% profit increase (Bain).
- Observe (O): The discipline of understanding before you offer — where the sale actually begins. Rackham's Huthwaite research across 35,000+ sales calls in 23 countries found that discovery question quality is the single strongest predictor of close rate in complex sales — more than charm, product knowledge, or presentation skills. Three levels of need: stated (surface), implicit (the real driver underneath), unknown (where great deals live — the prospect doesn't know yet). Silence is a sales tool. The rep who asks better questions beats the rep with the better pitch, every time.
- Offer (O): Stop selling. Start solving. Outcomes over features — every feature must be translated into a prospect outcome before you say it out loud (dopamine fires on anticipation of reward, not on product descriptions). The Challenger Sale finding: highest performers teach prospects something new about their own situation before presenting a solution. McKinsey: companies excelling at personalization generate 40% more revenue. Recommend, don't menu — decision fatigue is real, and fewer options close more deals.
- Secure (S): The close is not the end of the sale — it is the beginning of the relationship. Five buying signals to watch for: budget queries, timeline questions, comparison requests, clarification probes, process questions. Trial closes improve close rates by 40% (Sales Management Journal, 2023). Six closing techniques: Assumptive, Option, Summary, Urgency, Direct, Suggestion. The 24-hour follow-up rule: contact within 24 hours of every close to reduce buyer's remorse and protect weeks of work.
- Track (T): What you measure, you manage. What you manage, you improve. Six key metrics: lead-to-opportunity conversion rate, opportunity-to-close rate, average deal size, sales cycle length, referral rate, activity-to-outcome ratios. 57% of reps miss quota annually (Salesforce 2024) — the differentiator is measurement discipline, not talent. Data-driven teams grow revenue 20% faster (McKinsey 2024). High performers are 4.9x more likely to use their CRM actively (Salesforce).

---

SECTION 1 -- YOUR ${personality.primaryProfile.name.toUpperCase()} PROFILE
Using the BOOST framework language above, describe what it means to lead with ${personality.primaryProfile.name} energy in sales. Cover the core traits, what drives this personality, and how they naturally show up in client interactions. Then explain how the secondary ${personality.secondaryProfile.name} color modifies and adds depth to their approach — where these two colors reinforce each other and where they may create interesting tension. Be affirming and grounded. Speak directly to ${contact.fullName}. 2 paragraphs, 4–6 sentences each.

SECTION 2 -- UNDERSTANDING THE OTHER THREE COLORS
Using the Dr. McCafferty Sales Personality Test framework above, describe the three non-primary colors (${['Purple','Gold','Blue','Red'].filter(c => c !== personality.primaryProfile.name).join(', ')}). For each: how they make decisions, what they value most, what stresses them out, and the first signal they give off in a room. Close with the core insight: once you can read the room in 60 seconds, you stop selling generically and start selling specifically — that is when deals stop being a grind and start being a conversation. 2 paragraphs, 4–6 sentences each.

SECTION 3 -- DEFINING YOUR SCORES
Explain what Strength (80+), Developing (60–79), and Gap (below 60) mean in the BOOST system. Be clear that gaps reflect habits and learned patterns — not talent or ceiling. Ground this in John Dessauer's core belief: sales is a learnable, teachable skill. Fewer than 200 universities offer dedicated sales programs despite sales comprising over 10% of the national workforce — most people learned to sell by falling down. That is not a character flaw; it is a training gap. Normalize ${contact.fullName}'s results warmly and constructively. 2 paragraphs, 4–6 sentences each.

SECTION 4 -- YOUR BOOST SCORE DASHBOARD
Walk through all 5 BOOST pillars for ${contact.fullName}: Build Trust (${boostScores.build_trust.score}, ${boostScores.build_trust.status}), Observe (${boostScores.observe.score}, ${boostScores.observe.status}), Offer (${boostScores.offer.score}, ${boostScores.offer.status}), Secure (${boostScores.secure.score}, ${boostScores.secure.status}), Track (${boostScores.track.score}, ${boostScores.track.status}). For each pillar, state the score and status, then give one key insight grounded in the BOOST framework reference above. Reference the relevant research stat where it adds weight. Make the dashboard feel like a coaching conversation — each pillar pointing toward a specific action. 3 paragraphs, 4–6 sentences each.

SECTION 5 -- WHERE YOUR WIRING MEETS YOUR GAP: ${personality.primaryProfile.name.toUpperCase()} + ${primaryGap.pillar.toUpperCase()}
Using the BOOST color framework above, explain the specific relationship between ${personality.primaryProfile.name} personality wiring and the ${primaryGap.pillar} pillar — what natural tendencies of this color can create friction or blind spots in this area. Be specific and validating, not critical. Then give ${contact.fullName} 2–3 concrete, actionable directions grounded in their ${personality.primaryProfile.name} wiring that will move this score — not generic advice, but shifts that make sense for how this color naturally operates. Make it feel like a trusted advisor speaking, not a report. 2 paragraphs, 4–6 sentences each.

Total target: 550–650 words across all five sections.`

  // --- PROMPT 2: Sections 6–13 ---
  const prompt2 = `You are generating sections 6–13 of a BOOST Blueprint Sales Assessment Report for ${contact.fullName}. This report is based on the BOOST Sales Success System created by John Dessauer of RealWise Academy. Write in second person, speaking directly to ${contact.fullName}. Professional, direct, warm but data-driven. No markdown. Section headings must be exactly: "SECTION X --"

CRITICAL RULE: ONLY 4 colors exist in the BOOST system: Purple, Gold, Blue, Red. Never reference Green, Orange, or any other color under any circumstances.

RESPONDENT DATA:
- Name: ${contact.fullName} | Role: ${effectiveRole} | Experience: ${context.experience || 'Not specified'}
- Primary Color: ${personality.primaryProfile.name} (${personality.primaryProfile.style})
- Secondary Color: ${personality.secondaryProfile.name} (${personality.secondaryProfile.style})
- Primary Gap: ${primaryGap.pillar} (${primaryGap.score}) | Top Strength: ${topStrength.pillar} (${topStrength.score})
- Recommended Program: ${program}
- All BOOST Scores: Build Trust ${boostScores.build_trust.score}, Observe ${boostScores.observe.score}, Offer ${boostScores.offer.score}, Secure ${boostScores.secure.score}, Track ${boostScores.track.score}

BOOST FRAMEWORK REFERENCE — SELLING AS AND TO EACH COLOR (Chapter 16, BOOST: The Sales Success System):

SELLING AS PURPLE: Lead with the relationship, not the pitch. You are not selling from a vendor position — you are selling person to person. Be completely transparent; any hint of manipulation costs you the deal and the relationship. Show how your solution benefits people, not just the bottom line. Follow up with warmth — a thank-you note after the meeting does more than most reps realize. Do not rush the decision; Purples need to feel right about it, not just logical about it.

SELLING AS GOLD: Come prepared with documentation, data, and a clear process — winging it ends the meeting. Be punctual; tardiness communicates everything about how seriously you take this. Speak in specifics: numbers, timelines, deliverables — vague promises do not land. Show the track record: case studies, references, proven results close Gold personalities. Slow and steady wins this race; pressuring them backfires every time.

SELLING AS BLUE: Know your product better than your prospect does — if they catch you bluffing, it is over. Lead with data, logic, and evidence; skip the emotional appeal, it will make them suspicious. Let them ask deep questions; a Blue asking hard questions is a Blue getting interested. Give them time to think — they do not decide out loud, and the silence after your pitch is them running the numbers. Praise their intelligence, not their personality.

SELLING AS RED: Get to the point fast — they made up their mind about you before you finished your first sentence. Make it exciting; energy is contagious with Reds, and flatness is fatal. Give them options so they feel like they are choosing, not being sold. Appeal to their competitive nature — others in their industry are already doing this. Create genuine urgency; Reds believe waiting is emotional death.

SELLING TO PURPLE (adaptive move for non-Purple personalities): Be real. Build the relationship before anything else. They are not buying until they trust you. A genuine compliment lands harder than any discount. Do not rush them.

SELLING TO GOLD (adaptive move for non-Gold personalities): Be prepared — show up with documentation and a clear process. Know your product cold. Do what you say, every single time. Speak in specifics; vague promises do not land. Slow down and honor their timeline.

SELLING TO BLUE (adaptive move for non-Blue personalities): Match their intellect. Lead with evidence and data. Skip the small talk — they will endure it but they are not enjoying it. Let them challenge you; that means they are engaged. Give them space to think after your pitch before you push.

SELLING TO RED (adaptive move for non-Red personalities): Get to the point immediately. Make it exciting and make it feel urgent. Give them freedom to choose. Appeal to competition — what others in their space are already doing is gasoline on a fire. Match their energy; low energy with a Red means you have already lost.

BOOST PILLAR + COLOR DYNAMICS REFERENCE:
- Build Trust (B): Oxytocin is the neurochemical foundation. Genuine warmth triggers it, making prospects more open and willing to buy. Oxytocin increases perceived competence — trust in you literally increases belief in your solution (PLOS ONE). Five percent retention increase = 25–95% profit increase (Bain). The relationship is not soft strategy; it is the highest-ROI activity in professional selling.
- Observe (O): Questions are the answer — the Xerox revelation that John Dessauer has built his entire career on. Rackham research (35,000+ calls): discovery question quality is the single strongest predictor of close rate. Three levels of need: stated, implicit, unknown. The most valuable opportunities live at the unknown level — clients do not announce them. Silence is a sales tool; the rep who waits learns more in ten seconds than the one who fills the gap.
- Offer (O): Outcomes over features — dopamine fires on anticipation of reward, not product descriptions. Not "advanced analytics" but "three hours back every Friday." The Challenger Sale: highest performers teach the prospect something new about their own situation before presenting a solution. Recommend, don't menu — decision fatigue is neurologically real (Danziger parole study: grant rates dropped from 65% to near zero across a single day).
- Secure (S): The close is the beginning of the relationship. Five buying signals: budget queries, timeline questions, comparison requests, clarification probes, process questions. Trial closes improve close rates 40% (Sales Management Journal, 2023). Six techniques: Assumptive, Option, Summary, Urgency, Direct, Suggestion — match the technique to the prospect's color and MBF. 24-hour follow-up rule: it costs fifteen minutes and protects weeks of work.
- Track (T): 57% of reps miss quota annually — the differentiator is measurement discipline, not talent (Salesforce 2024). Six metrics: lead-to-opportunity, opportunity-to-close, average deal size, sales cycle length, referral rate, activity-to-outcome. Referral rate is the leading indicator of relationship health — watch it monthly. Data-driven teams grow revenue 20% faster (McKinsey 2024). High performers are 4.9x more likely to use CRM actively.

PROGRAM DESCRIPTIONS (RealWise Academy):
- 1-Hour Consulting: A focused, high-impact single session with John Dessauer. Right for individual reps with few gaps who need targeted clarity and direction.
- 10-Pack Consulting: Ten sessions of systematic coaching to close skill gaps. For reps with 2+ gaps or multiple developing areas who need structured, sustained development.
- Yearly Consulting: A full-year coaching relationship with John Dessauer. For experienced professionals with persistent gaps or reps ready to build lasting mastery and compound their results.
- BOOST Group & Team Sales Coaching: For Sales Managers and Business Owners leading small teams. Group coaching to build BOOST as a shared language and team culture — turning individual skill into organizational system.
- BOOST CSO Strategic Overhaul: For organizations with 21+ people. A strategic, top-down implementation of the BOOST system across the entire sales organization — not training, transformation.

---

SECTION 6 -- YOUR BOOST BLUEPRINT: SELLING AS A ${personality.primaryProfile.name.toUpperCase()}
Using the BOOST framework above, give ${contact.fullName} one specific principle per pillar (Build Trust, Observe, Offer, Secure, Track) tailored precisely to how a ${personality.primaryProfile.name} naturally operates. For each pillar, explain why this approach works specifically for their color wiring — where their natural strengths create leverage and where they need to be intentional. Ground this in the BOOST system language from John Dessauer. 2 paragraphs, 4–6 sentences each.

SECTION 7 -- SELLING TO THE OTHER THREE COLORS
Using the adaptive selling guidance above for a ${personality.primaryProfile.name} seller, describe how ${contact.fullName} should approach each of the three non-primary colors (${['Purple','Gold','Blue','Red'].filter(c => c !== personality.primaryProfile.name).join(', ')}). For each: how to read them in the first 60 seconds, what they need most to move toward a decision, and the specific adaptive move a ${personality.primaryProfile.name} needs to make — including what natural tendencies of their own color to watch out for in that interaction. 2 paragraphs, 4–6 sentences each.

SECTION 8 -- THE SCIENCE BEHIND BOOST
Explain the neuroscience foundation of the BOOST system using John Dessauer's framework: oxytocin drives trust and increases perceived competence (PLOS ONE); dopamine fires on anticipation of reward — which is why outcomes beat features every time; cortisol signals real urgency and, when acknowledged ethically, motivates action. Reference: 95% of purchasing decisions are made subconsciously (Zaltman, Harvard) — rational analysis is mostly post-hoc justification for an emotional decision already made. Science-based selling produces 35% higher close rates and 20% larger deals (HBR 2024). Make this feel like conviction, not a lecture — this is why BOOST works. 2 paragraphs, 4–6 sentences each.

SECTION 9 -- YOUR PERSONALIZED PLAYBOOK: THREE BEHAVIORAL SHIFTS
Give ${contact.fullName} three specific behavioral shifts tied directly to their ${personality.primaryProfile.name} wiring and their ${primaryGap.pillar} gap. For each shift: name the exact behavior change, explain why it matters specifically for the intersection of their color and this gap, and describe the concrete result they can expect. These should feel like coaching from someone who knows their file — not generic advice. Make them immediately actionable. 2 paragraphs, 4–6 sentences each.

SECTION 10 -- WHY COACHING IS THE MULTIPLIER
Training alone changes behavior in only 1 in 5 reps. Training combined with structured ongoing coaching produces 4x greater behavior change (HBR 2024, LSA Global). Real-time feedback, deal debriefs, and accountability break ingrained habits that reading and training alone cannot touch. Explain why this matters specifically for ${contact.fullName}'s ${primaryGap.pillar} gap — what a sustained coaching relationship makes possible that self-study alone never will. Reference John Dessauer's direct coaching approach at RealWise Academy. 2 paragraphs, 4–6 sentences each.

SECTION 11 -- YOUR RECOMMENDED PROGRAM
Explain clearly and specifically why ${program} is the right fit for ${contact.fullName} — reference their gap (${primaryGap.pillar} at ${primaryGap.score}), their role (${effectiveRole}), and their experience (${context.experience || 'not specified'}). Use the program description above to describe what they will build and what the experience looks like. This is not a sales pitch — it is a clinical recommendation from a trusted advisor who has reviewed their full profile. Be direct and specific. 2 paragraphs, 4–6 sentences each.

SECTION 12 -- WHAT SUCCESS LOOKS LIKE: THE 90-DAY VIEW
Paint a specific and compelling picture of ${contact.fullName}'s results after 90 days of focused BOOST development: stronger close rates, deeper client relationships, a growing referral pipeline, and greater confidence in every sales conversation. Make this specific to their ${personality.primaryProfile.name} strengths being deployed more intentionally and their ${primaryGap.pillar} gap closing. Reference John Dessauer's core belief: skills compound — every additional close funds the next opportunity, every relationship generates referrals, and every win builds the reputation that opens doors you haven't knocked on yet. 2 paragraphs, 4–6 sentences each.

SECTION 13 -- YOUR NEXT STEP: BOOK YOUR STRATEGY CALL
Tell ${contact.fullName} to book at https://realwiseacademy.com/#programs. Describe what happens on the 30-minute strategy call with John Dessauer: review the assessment results together, confirm program fit, and map the first 90 days. Make this feel like an open door — not a pressure close, but a genuine next step for someone who is ready to build on what this report has surfaced. End the section — and the entire report — with this exact sentence on its own line: "Your potential is not a mystery. It's a science. And it's waiting for you to unlock it. Let's go." 2 paragraphs, 4–6 sentences each.

Total target: 800–950 words across all eight sections.`

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
