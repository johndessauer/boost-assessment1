import React from 'react'
import { Header, styles, colors } from '../styles.jsx'

export default function ThankYou({ contact }) {
  return (
    <div style={styles.page}>
      <Header />
      <div style={styles.card}>
        {/* Success icon */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%', background: '#E8F5E9',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <span style={{ fontSize: 40 }}>✓</span>
          </div>
          <h1 style={{ ...styles.h1, textAlign: 'center', fontSize: 32 }}>You're All Set!</h1>
          <p style={{ fontSize: 16, color: colors.darkGray, marginTop: 8 }}>
            Your BOOST Blueprint Report is being generated right now.
          </p>
        </div>

        <div style={{ background: colors.lightGray, borderRadius: 10, padding: '20px 24px', marginBottom: 24 }}>
          <p style={{ fontSize: 15, color: colors.black, lineHeight: 1.7 }}>
            <strong>What happens next:</strong><br />
            Your personalized report will arrive at <strong style={{ color: colors.red }}>{contact?.email}</strong> within the next few minutes. Check your spam folder if you don't see it.
          </p>
        </div>

        <div style={{ ...styles.infoBox, marginBottom: 24 }}>
          <p style={{ fontSize: 14, color: colors.black, lineHeight: 1.6 }}>
            <strong>Want to review your results with John personally?</strong><br />
            Book a complimentary 30-minute Strategy Call and we'll walk through your report together — no pitch, just a real conversation about your sales career.
          </p>
        </div>

        <a
          href="https://realwiseacademy.com/#programs"
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...styles.btnPrimary, textDecoration: 'none', display: 'flex' }}
        >
          Book Your Strategy Call →
        </a>

        <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${colors.border}`, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: colors.midGray }}>
            RealWise Academy  |  Powered by Dessauer Group<br />
            Questions? Email <a href="mailto:john@thedessauergroup.com" style={{ color: colors.red }}>john@thedessauergroup.com</a>
          </p>
        </div>
      </div>
    </div>
  )
}
