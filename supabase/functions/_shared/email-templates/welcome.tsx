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
        <Heading style={h1}>
          Welcome to Equity<span style={{ color: '#148a9e' }}>IQ</span> 📈
        </Heading>
        <Text style={text}>
          Hey {displayName}! 👋
        </Text>
        <Text style={text}>
          Thanks for joining EquityLens. Your account is set up and ready to go.
          Here's what you can do:
        </Text>
        <Text style={featureText}>
          📊 <strong>Track stocks in real time</strong> — add NSE & BSE stocks to your watchlist{'\n'}
          🔔 <strong>Set price triggers</strong> — get notified when a stock hits your target price{'\n'}
          📋 <strong>Multiple watchlists</strong> — organize stocks into separate groups{'\n'}
          📤 <strong>Share watchlists</strong> — export or share with anyone via a link
        </Text>
        <Button style={button} href={siteUrl}>
          Open Your Dashboard
        </Button>
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

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#131a24',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#6a6f78',
  lineHeight: '1.5',
  margin: '0 0 20px',
}
const featureText = {
  fontSize: '14px',
  color: '#6a6f78',
  lineHeight: '2',
  margin: '0 0 25px',
  whiteSpace: 'pre-line' as const,
}
const button = {
  backgroundColor: '#148a9e',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '12px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const hr = {
  borderColor: '#e5e7eb',
  margin: '30px 0 20px',
}
const footer = { fontSize: '12px', color: '#999999', margin: '0' }
