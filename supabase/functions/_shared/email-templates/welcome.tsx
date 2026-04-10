/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  Hr,
  Section,
} from 'npm:@react-email/components@0.0.22'

interface WelcomeEmailProps {
  displayName: string
  siteUrl: string
}

export const WelcomeEmail = ({
  displayName,
  siteUrl,
}: WelcomeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to EquityLens — your stock watchlist is ready!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Text style={brandText}>
            Equity<span style={{ color: '#22d3ee' }}>Lens</span>
          </Text>
        </Section>

        <Heading style={h1}>
          Welcome aboard! 📈
        </Heading>
        <Text style={text}>
          Hey {displayName}! 👋
        </Text>
        <Text style={text}>
          Thanks for joining EquityLens. Your account is set up and ready to go.
        </Text>

        <Section style={featuresGrid}>
          <table style={{ width: '100%' }}>
            <tr>
              <td style={featureCard}>
                <Text style={featureEmoji}>📊</Text>
                <Text style={featureTitle}>Real-time Tracking</Text>
                <Text style={featureDesc}>NSE & BSE stocks, live</Text>
              </td>
              <td style={{ width: '10px' }} />
              <td style={featureCard}>
                <Text style={featureEmoji}>🔔</Text>
                <Text style={featureTitle}>Price Triggers</Text>
                <Text style={featureDesc}>Get notified at target</Text>
              </td>
            </tr>
            <tr><td style={{ height: '10px' }} /><td /><td /></tr>
            <tr>
              <td style={featureCard}>
                <Text style={featureEmoji}>📋</Text>
                <Text style={featureTitle}>Watchlists</Text>
                <Text style={featureDesc}>Organize into groups</Text>
              </td>
              <td style={{ width: '10px' }} />
              <td style={featureCard}>
                <Text style={featureEmoji}>⚡</Text>
                <Text style={featureTitle}>Smart Alerts</Text>
                <Text style={featureDesc}>Auto-detect anomalies</Text>
              </td>
            </tr>
          </table>
        </Section>

        <Section style={{ textAlign: 'center' as const, margin: '28px 0' }}>
          <Button style={button} href={siteUrl}>
            Open Your Dashboard →
          </Button>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>
          You're receiving this because you signed up on EquityLens.
          If you didn't create this account, please ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default WelcomeEmail

const main = {
  backgroundColor: '#0f1419',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
}
const container = {
  padding: '32px 24px',
  maxWidth: '560px',
  margin: '0 auto',
}
const headerSection = { marginBottom: '24px' }
const brandText = {
  fontSize: '18px',
  fontWeight: 'bold' as const,
  color: '#e2e8f0',
  margin: '0',
}
const h1 = {
  fontSize: '26px',
  fontWeight: 'bold' as const,
  color: '#f1f5f9',
  margin: '0 0 16px',
  letterSpacing: '-0.02em',
}
const text = {
  fontSize: '14px',
  color: '#94a3b8',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const featuresGrid = {
  margin: '24px 0',
}
const featureCard = {
  backgroundColor: '#1a2332',
  borderRadius: '12px',
  padding: '16px',
  border: '1px solid #1e293b',
  width: '50%',
  verticalAlign: 'top' as const,
}
const featureEmoji = {
  fontSize: '20px',
  margin: '0 0 8px',
  lineHeight: '1',
}
const featureTitle = {
  fontSize: '13px',
  fontWeight: 'bold' as const,
  color: '#e2e8f0',
  margin: '0 0 4px',
}
const featureDesc = {
  fontSize: '11px',
  color: '#64748b',
  margin: '0',
  lineHeight: '1.4',
}
const button = {
  backgroundColor: '#22d3ee',
  color: '#0f1419',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  borderRadius: '10px',
  padding: '14px 28px',
  textDecoration: 'none',
}
const hr = {
  borderColor: '#1e293b',
  margin: '28px 0 20px',
}
const footer = {
  fontSize: '11px',
  color: '#475569',
  margin: '0',
  lineHeight: '1.5',
}
