/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
  Hr,
  Section,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email for EquityIQ</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Text style={brandText}>
            Equity<span style={{ color: '#22d3ee' }}>IQ</span>
          </Text>
        </Section>

        <Heading style={h1}>Verify your email 📧</Heading>
        <Text style={text}>
          Thanks for signing up! You're one step away from tracking your
          favorite stocks in real time.
        </Text>
        <Text style={text}>
          Please confirm your email address (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) by clicking below:
        </Text>

        <Section style={{ textAlign: 'center' as const, margin: '28px 0' }}>
          <Button style={button} href={confirmationUrl}>
            Verify Email →
          </Button>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>
          If you didn't create an account on EquityIQ, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

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
const link = { color: '#22d3ee', textDecoration: 'underline' }
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
