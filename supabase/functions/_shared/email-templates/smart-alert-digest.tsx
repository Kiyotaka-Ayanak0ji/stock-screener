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

interface SmartAlertDigestEmailProps {
  displayName: string
  alerts: Array<{
    type: string
    ticker: string
    message: string
    detail: string
    timestamp: string
  }>
}

const getAlertEmoji = (type: string) => {
  switch (type) {
    case '52w_high': return '📈'
    case '52w_low': return '📉'
    case 'volume_spike': return '🔊'
    default: return '⚡'
  }
}

const getAlertLabel = (type: string) => {
  switch (type) {
    case '52w_high': return 'Session High'
    case '52w_low': return 'Session Low'
    case 'volume_spike': return 'Volume Spike'
    default: return 'Alert'
  }
}

export const SmartAlertDigestEmail = ({
  displayName,
  alerts,
}: SmartAlertDigestEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      ⚡ {alerts.length} smart alert{alerts.length > 1 ? 's' : ''} detected on EquityIQ
    </Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header */}
        <Section style={headerSection}>
          <table style={{ width: '100%' }}>
            <tr>
              <td>
                <Text style={brandText}>
                  Equity<span style={{ color: '#22d3ee' }}>IQ</span>
                </Text>
              </td>
              <td style={{ textAlign: 'right' as const }}>
                <Text style={badgeStyle}>⚡ Smart Alerts</Text>
              </td>
            </tr>
          </table>
        </Section>

        <Heading style={h1}>
          Smart Alert Digest
        </Heading>
        <Text style={text}>
          Hey {displayName}, here's what our system detected in your watchlist:
        </Text>

        {/* Alert Cards */}
        {alerts.map((alert, i) => (
          <Section key={i} style={alertCard}>
            <table style={{ width: '100%' }}>
              <tr>
                <td style={{ width: '40px', verticalAlign: 'top' as const, paddingTop: '2px' }}>
                  <Text style={emojiStyle}>{getAlertEmoji(alert.type)}</Text>
                </td>
                <td>
                  <Text style={alertTicker}>{alert.ticker}</Text>
                  <Text style={alertLabelStyle}>{getAlertLabel(alert.type)}</Text>
                  <Text style={alertDetail}>{alert.detail}</Text>
                  <Text style={alertTime}>{alert.timestamp}</Text>
                </td>
              </tr>
            </table>
          </Section>
        ))}

        <Hr style={hr} />
        <Text style={footer}>
          Smart alerts are automatically detected when stocks in your watchlist
          hit session highs/lows or show unusual volume activity.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SmartAlertDigestEmail

const main = {
  backgroundColor: '#0f1419',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
}
const container = {
  padding: '32px 24px',
  maxWidth: '560px',
  margin: '0 auto',
}
const headerSection = {
  marginBottom: '24px',
}
const brandText = {
  fontSize: '18px',
  fontWeight: 'bold' as const,
  color: '#e2e8f0',
  margin: '0',
}
const badgeStyle = {
  fontSize: '11px',
  fontWeight: '600' as const,
  color: '#22d3ee',
  backgroundColor: '#22d3ee15',
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
const emojiStyle = {
  fontSize: '20px',
  margin: '0',
  lineHeight: '1',
}
const alertTicker = {
  fontSize: '16px',
  fontWeight: 'bold' as const,
  color: '#f1f5f9',
  margin: '0 0 2px',
  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
}
const alertLabelStyle = {
  fontSize: '11px',
  fontWeight: '600' as const,
  color: '#22d3ee',
  margin: '0 0 6px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
}
const alertDetail = {
  fontSize: '13px',
  color: '#94a3b8',
  margin: '0 0 4px',
}
const alertTime = {
  fontSize: '11px',
  color: '#64748b',
  margin: '0',
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
