// ─── BRAND COLORS ─────────────────────────────────────────────────────────────
export const colors = {
  red:       '#E4181B',
  black:     '#1A1A1A',
  darkGray:  '#444444',
  midGray:   '#999999',
  lightGray: '#F2F2F2',
  border:    '#E0E0E0',
  white:     '#FFFFFF',
}

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
export const styles = {
  page: {
    minHeight: '100vh',
    background: colors.lightGray,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0 0 60px 0',
  },
  header: {
    width: '100%',
    background: colors.black,
    padding: '16px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 32,
  },
  headerTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '0.02em',
  },
  headerSub: {
    color: colors.midGray,
    fontSize: 13,
  },
  card: {
    background: colors.white,
    borderRadius: 12,
    padding: '40px 48px',
    maxWidth: 720,
    width: '100%',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    margin: '0 16px',
  },
  cardWide: {
    background: colors.white,
    borderRadius: 12,
    padding: '40px 48px',
    maxWidth: 960,
    width: '100%',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    margin: '0 16px',
  },
  h1: {
    fontSize: 28,
    fontWeight: 800,
    color: colors.black,
    marginBottom: 8,
  },
  h2: {
    fontSize: 22,
    fontWeight: 700,
    color: colors.black,
    marginBottom: 8,
  },
  h3: {
    fontSize: 16,
    fontWeight: 700,
    color: colors.red,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  subText: {
    fontSize: 15,
    color: colors.darkGray,
    lineHeight: 1.6,
    marginBottom: 24,
  },
  label: {
    display: 'block',
    fontSize: 14,
    fontWeight: 600,
    color: colors.black,
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    border: `1.5px solid ${colors.border}`,
    borderRadius: 8,
    fontSize: 15,
    color: colors.black,
    background: colors.white,
    outline: 'none',
    transition: 'border-color 0.2s',
    marginBottom: 20,
  },
  select: {
    width: '100%',
    padding: '12px 16px',
    border: `1.5px solid ${colors.border}`,
    borderRadius: 8,
    fontSize: 15,
    color: colors.black,
    background: colors.white,
    outline: 'none',
    marginBottom: 20,
    cursor: 'pointer',
  },
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: colors.red,
    color: colors.white,
    border: 'none',
    borderRadius: 8,
    padding: '14px 32px',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
    transition: 'opacity 0.2s',
    letterSpacing: '0.02em',
  },
  btnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    color: colors.darkGray,
    border: `1.5px solid ${colors.border}`,
    borderRadius: 8,
    padding: '12px 24px',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  divider: {
    height: 1,
    background: colors.border,
    margin: '28px 0',
  },
  progressBar: (pct) => ({
    width: '100%',
    height: 6,
    background: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 32,
    child: {
      height: '100%',
      width: `${pct}%`,
      background: colors.red,
      borderRadius: 3,
      transition: 'width 0.4s ease',
    }
  }),
  infoBox: {
    background: '#FFF5F5',
    border: `1px solid ${colors.red}`,
    borderRadius: 8,
    padding: '16px 20px',
    marginBottom: 24,
  },
}

// ─── HEADER COMPONENT ─────────────────────────────────────────────────────────
export function Header() {
  return (
    <div style={styles.header}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={styles.headerTitle}>BOOST Blueprint Sales Assessment</span>
        <span style={styles.headerSub}>RealWise Academy  |  Powered by Dessauer Group</span>
      </div>
    </div>
  )
}

// ─── PROGRESS BAR ─────────────────────────────────────────────────────────────
export function ProgressBar({ step, total, label }) {
  const pct = Math.round((step / total) * 100)
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: colors.darkGray }}>{label}</span>
        <span style={{ fontSize: 13, color: colors.midGray }}>{pct}% complete</span>
      </div>
      <div style={{ width: '100%', height: 6, background: colors.border, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: colors.red, borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

// ─── STEP INDICATOR ───────────────────────────────────────────────────────────
export function StepIndicator({ current }) {
  const steps = ['Contact', 'Payment', 'Assessment', 'Report']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: i < current ? colors.red : i === current ? colors.red : colors.border,
              color: i <= current ? colors.white : colors.midGray,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700,
              border: i === current ? `2px solid ${colors.red}` : 'none',
            }}>
              {i < current ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: 11, color: i <= current ? colors.red : colors.midGray, fontWeight: 600 }}>{s}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: 2, background: i < current ? colors.red : colors.border, marginBottom: 18, minWidth: 24 }} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}
