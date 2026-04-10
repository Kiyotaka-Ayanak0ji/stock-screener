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

interface PriceTriggerDigestEmailProps {
  displayName: string
  alerts: Array<{
    ticker: string
    triggerPrice: number
    hitPrice: number
    timestamp: string
  }>
}

export const PriceTriggerDigestEmail = ({
  displayName,
  alerts,
}: PriceTriggerDigestEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      🔔 {alerts.length} price trigger{alerts.length > 1 ? 's' : ''} hit on EquityLens
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <table style={{ width: '100%' }}>
            <tr>
              <td>
                <Text style={brandText}>
                  Equity<span style={{ color: '#22d3ee' }}>Lens</span>
                </Text>
              </td>
              <td style={{ textAlign: 'right' as const }}>
                <Text style={badgeStyle}>🔔 Price Alerts</Text>
              </td>
            </tr>
          </table>
        </Section>

        <Heading style={h1}>
          Price Trigger Alert
        </Heading>
        <Text style={text}>
          Hey {displayName}, your price triggers have been hit!
        </Text>

        {alerts.map((alert, i) => (
          <Section key={i} style={alertCard}>
            <table style={{ width: '100%' }}>
              <tr>
                <td>
                  <Text style={tickerStyle}>{alert.ticker}</Text>
                  <Text style={labelStyle}>Target Hit</Text>
                </td>
                <td style={{ textAlign: 'right' as const, verticalAlign: 'top' as const }}>
                  <Text style={priceStyle}>₹{alert.hitPrice.toFixed(2)}</Text>
                  <Text style={targetStyle}>Target: ₹{alert.triggerPrice.toFixed(2)}</Text>
                </td>
              </tr>
              <tr>
                <td colSpan={2}>
                  <Text style={timeStyle}>{alert.timestamp}</Text>
                </td>
              </tr>
            </table>
          </Section>
        ))}

        <Hr style={hr} />
        <Text style={footer}>
          You're receiving this because you set price triggers on EquityLens.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default PriceTriggerDigestEmail

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
const badgeStyle = {
  fontSize: '11px',
  fontWeight: '600' as const,
  color: '#fbbf24',
  backgroundColor: '#fbbf2415',
  padding: '4px 10px',
  borderRadius: '20px',
  margin: '0',
  display: 'inline-block' as const,
}
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#f1f5f9',
  margin: '0 0 12px',
  letterSpacing: '-0.02em',
}
const text = {
  fontSize: '14px',
  color: '#94a3b8',
  lineHeight: '1.6',
  margin: '0 0 24px',
}
const alertCard = {
  backgroundColor: '#1a2332',
  borderRadius: '12px',
  padding: '16px',
  marginBottom: '10px',
  border: '1px solid #1e293b',
}
const tickerStyle = {
  fontSize: '18px',
  fontWeight: 'bold' as const,
  color: '#f1f5f9',
  margin: '0 0 2px',
  fontFamily: '"JetBrains Mono", monospace',
}
const labelStyle = {
  fontSize: '11px',
  fontWeight: '600' as const,
  color: '#4ade80',
  margin: '0',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
}
const priceStyle = {
  fontSize: '18px',
  fontWeight: 'bold' as const,
  color: '#22d3ee',
  margin: '0 0 2px',
  fontFamily: '"JetBrains Mono", monospace',
}
const targetStyle = {
  fontSize: '11px',
  color: '#64748b',
  margin: '0',
}
const timeStyle = {
  fontSize: '11px',
  color: '#475569',
  margin: '8px 0 0',
}
const hr = {
  borderColor: '#1e293b',
  margin: '24px 0',
}
const footer = {
  fontSize: '11px',
  color: '#475569',
  margin: '0',
  lineHeight: '1.5',
}
