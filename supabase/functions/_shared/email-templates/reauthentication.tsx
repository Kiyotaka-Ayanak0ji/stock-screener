/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  Hr,
  Section,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your EquityIQ verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Text style={brandText}>
            Equity<span style={{ color: '#22d3ee' }}>IQ</span>
          </Text>
        </Section>

        <Heading style={h1}>Verification code 🔑</Heading>
        <Text style={text}>Use the code below to confirm your identity:</Text>

        <Section style={codeSection}>
          <Text style={codeStyle}>{token}</Text>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>
          This code will expire shortly. If you didn't request this, you can
          safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

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
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#f1f5f9',
  margin: '0 0 16px',
  letterSpacing: '-0.02em',
}
const text = {
  fontSize: '14px',
  color: '#94a3b8',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const codeSection = {
  backgroundColor: '#1a2332',
  borderRadius: '12px',
  padding: '20px',
  textAlign: 'center' as const,
  margin: '24px 0',
  border: '1px solid #1e293b',
}
const codeStyle = {
  fontFamily: '"JetBrains Mono", "Fira Code", Courier, monospace',
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: '#22d3ee',
  margin: '0',
  letterSpacing: '0.15em',
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
