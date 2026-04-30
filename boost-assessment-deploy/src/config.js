// ─── EDITABLE CONFIG FILE ─────────────────────────────────────────────────────
// Edit questions, labels, and options here without touching any other code.

export const PRICE_CENTS = 9700; // $97.00
export const PRODUCT_NAME = 'BOOST Blueprint Sales Assessment';

// ── PART 1: Personality Assessment ───────────────────────────────────────────
// Columns: A=Purple (Warm/Relational), B=Gold (Analytical), C=Blue (Visionary), D=Red (Driver)
export const personalityRows = [
  { A: 'Agreeable\nCaring',        B: 'Loyal\nResponsible',       C: 'Competent\nIngenious',      D: 'Daring\nSpontaneous'      },
  { A: 'Real\nUnique',             B: 'Practical\nSensible',       C: 'Curious\nInventive',        D: 'Competitive\nImpetuous'   },
  { A: 'Personal\nTender',         B: 'Parental\nDependable',      C: 'Conceptual\nKnowledgeable', D: 'Skillful\nEffective'      },
  { A: 'Affectionate\nOpen',       B: 'Conservative\nTraditional', C: 'Theoretical\nSeeking',      D: 'Realistic\nOpen-minded'   },
  { A: 'Devoted\nSensitive',       B: 'Organized\nProcedural',     C: 'Versatile\nComplex',        D: 'Active\nAdventuresome'    },
  { A: 'Poetic\nDramatic',         B: 'Cooperative\nTeam Player',  C: 'Composed\nDetermined',      D: 'Opportunistic\nOptimistic' },
  { A: 'Inspirational\nEnergetic', B: 'Orderly\nConventional',     C: 'Thinking\nRational',        D: 'Impulsive\nFun'           },
  { A: 'Warm\nSympathetic',        B: 'Concerned\nCaring',         C: 'Principled\nIndependent',   D: 'Exciting\nCourageous'     },
];

export const profileLabels = {
  A: { name: 'Purple', style: 'Warm / Relational' },
  B: { name: 'Gold',   style: 'Analytical / Deliberate' },
  C: { name: 'Blue',   style: 'Visionary / Creative' },
  D: { name: 'Red',    style: 'Driver / Results-Focused' },
};

// ── PART 2: BOOST Skill Assessment ────────────────────────────────────────────
export const skillSections = [
  {
    id: 'build_trust',
    label: 'Section 1',
    pillar: 'Build Trust',
    pillarLetter: 'B',
    questions: [
      'I establish genuine personal connection before discussing business.',
      'I consistently demonstrate expertise without coming across as arrogant.',
      'Prospects tell me they feel heard and understood during our conversations.',
      'I follow through on every commitment I make — no matter how small.',
    ],
  },
  {
    id: 'observe',
    label: 'Section 2',
    pillar: 'Observe',
    pillarLetter: 'O',
    questions: [
      'I ask open-ended discovery questions before presenting any solution.',
      "I can identify what is truly driving a prospect's buying decision within the first 10 minutes.",
      'I spend more time listening than talking in a typical sales interaction.',
      'I regularly uncover needs or concerns the prospect did not initially mention.',
    ],
  },
  {
    id: 'offer',
    label: 'Section 3',
    pillar: 'Offer',
    pillarLetter: 'O',
    questions: [
      'I tailor every presentation specifically to what I learned during discovery.',
      'I know my unique value and communicate it clearly and confidently every time.',
      'I present solutions that connect directly to both emotional and logical motivators I observed.',
      'I structure my offers to reduce confusion and make the decision easy.',
    ],
  },
  {
    id: 'secure',
    label: 'Section 4',
    pillar: 'Secure',
    pillarLetter: 'S',
    questions: [
      'I recognize and address objections before the prospect voices them.',
      'I use trial closes naturally throughout a conversation to gauge readiness.',
      'I ask for the commitment directly, without hesitation or excessive hedging.',
      'I have a reliable system for handling my most common objections.',
    ],
  },
  {
    id: 'track',
    label: 'Section 5',
    pillar: 'Track',
    pillarLetter: 'T',
    questions: [
      'I track my key sales metrics (conversion rate, close rate, pipeline) at least weekly.',
      'I review lost deals to identify specifically what I could have done differently.',
      'I set measurable sales goals and review progress against them regularly.',
      'I use data from past performance to adjust my approach rather than relying on intuition alone.',
    ],
  },
];

// ── PART 3: Context Questions ─────────────────────────────────────────────────
export const contextQuestions = [
  {
    id: 'industry',
    question: 'What industry do you sell in?',
    type: 'text',
    placeholder: 'e.g. Medical Devices, SaaS, Real Estate...',
  },
  {
    id: 'role',
    question: 'What is your current role?',
    type: 'select',
    options: ['Individual Sales Rep', 'Sales Manager', 'Business Owner', 'Entrepreneur', 'Other'],
  },
  {
    id: 'experience',
    question: 'How many years have you been in sales?',
    type: 'select',
    options: ['0–1 years', '2–5 years', '6–10 years', '11–20 years', '20+ years'],
  },
  {
    id: 'team_size',
    question: 'How large is your sales team (if applicable)?',
    type: 'select',
    options: ['Just me', '2–5', '6–20', '21–100', '100+'],
  },
  {
    id: 'business_structure',
    question: 'Do you have employees or independent contractors working in sales for you?',
    type: 'select',
    options: ['No, just me', 'Yes, I have a small team'],
    conditional: { field: 'role', value: 'Entrepreneur' },
  },
  {
    id: 'team_challenges',
    question: 'What are your top sales challenges today? (Select all that apply)',
    type: 'multi-select',
    options: [
      'Talent acquisition and retention',
      'Economic uncertainty / longer sales cycles / tighter budgets',
      'Selling in the AI age',
      'Building a more skilled sales team (objections, lead gen, etc.)',
      'Tracking and data',
      'Other',
    ],
    conditional: { field: 'showForTeam', value: true },
  },
  {
    id: 'challenge',
    question: 'What is your primary sales challenge right now?',
    type: 'select',
    options: [
      'Building trust with new prospects',
      'Identifying real needs',
      'Presenting & differentiating my offer',
      'Closing & handling objections',
      'Tracking & improving performance',
      'Consistency and accountability',
    ],
  },
  {
    id: 'goal',
    question: 'What is your primary goal from this assessment?',
    type: 'select',
    options: [
      'Identify my biggest skill gap',
      'Get a personalized training roadmap',
      'Understand how my personality affects my selling',
      'Find the right RealWise program',
      'All of the above',
    ],
  },
  {
    id: 'current_training',
    question: 'Are you currently in any formal sales training?',
    type: 'select',
    options: ['Yes, actively', 'Yes, but inconsistently', 'No, but interested', 'No'],
  },
  {
    id: 'income',
    question: 'Current annual sales income or revenue?',
    type: 'select',
    options: ['Under $50K', '$50K–$100K', '$100K–$250K', '$250K–$500K', '$500K+', 'Prefer not to say'],
  },
  {
    id: 'target_income',
    question: 'Target income or revenue in the next 12 months?',
    type: 'text',
    placeholder: 'e.g. $150,000',
  },
  {
    id: 'referral',
    question: 'How did you hear about the BOOST Blueprint Assessment?',
    type: 'select',
    options: ['Email', 'Social Media', 'Referral', 'Podcast', 'Book', 'Website', 'Other'],
  },
];

// ── SCORING ───────────────────────────────────────────────────────────────────
export function calculatePersonalityProfile(rankings) {
  // rankings = array of 8 objects { A, B, C, D } each 1-4
  const totals = { A: 0, B: 0, C: 0, D: 0 };
  rankings.forEach(row => {
    totals.A += Number(row.A);
    totals.B += Number(row.B);
    totals.C += Number(row.C);
    totals.D += Number(row.D);
  });
  const sorted = Object.entries(totals).sort((a, b) => a[1] - b[1]);
  return {
    totals,
    primary: sorted[0][0],
    secondary: sorted[1][0],
    primaryProfile: profileLabels[sorted[0][0]],
    secondaryProfile: profileLabels[sorted[1][0]],
  };
}

export function calculateBoostScores(ratings) {
  // ratings = { build_trust: [1,2,3,4], observe: [...], ... }
  const scores = {};
  skillSections.forEach(section => {
    const raw = ratings[section.id].reduce((sum, val) => sum + Number(val), 0);
    const score = Math.round(((raw - 4) / 16) * 100);
    const status = score >= 80 ? 'Strength' : score >= 60 ? 'Developing' : 'Gap';
    scores[section.id] = { raw, score, status, pillar: section.pillar, pillarLetter: section.pillarLetter, label: section.label };
  });
  return scores;
}

export function getProgramRecommendation(boostScores, context) {
  // Determine effective role
  let effectiveRole = context.role;
  if (context.role === 'Entrepreneur') {
    if (context.business_structure === 'No, just me') {
      effectiveRole = 'Individual Sales Rep';
    } else if (context.business_structure === 'Yes, I have a small team') {
      effectiveRole = 'Business Owner';
    }
  }

  // Team-based programs
  const isTeam = ['Sales Manager', 'Business Owner'].includes(effectiveRole) || ['2–5','6–20','21–100','100+'].includes(context.team_size);
  if (isTeam && ['21–100','100+'].includes(context.team_size)) return 'BOOST CSO Strategic Overhaul';
  if (isTeam) return 'BOOST Group & Team Sales Coaching';

  // Individual programs (based on gaps)
  const gaps = Object.values(boostScores).filter(s => s.status === 'Gap').length;
  const developing = Object.values(boostScores).filter(s => s.status === 'Developing').length;
  const experienced = ['6–10 years','11–20 years','20+ years'].includes(context.experience);
  if (gaps >= 3 || (experienced && gaps >= 1)) return 'Yearly Consulting';
  if (gaps >= 2 || developing >= 3) return '10-Pack Consulting';
  return '1-Hour Consulting';
}
