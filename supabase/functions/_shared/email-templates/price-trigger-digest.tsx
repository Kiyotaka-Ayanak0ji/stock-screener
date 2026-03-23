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
      🔔 {alerts.length} price trigger{alerts.length > 1 ? 's' : ''} hit on StockSense
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          🔔 Price Trigger Alert
        </Heading>
        <Text style={text}>
          Hey {displayName}, your price triggers have been hit!
        </Text>

        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Stock</th>
              <th style={thStyle}>Target</th>
              <th style={thStyle}>Hit Price</th>
              <th style={thStyle}>Time</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert, i) => (
              <tr key={i}>
                <td style={tdStyle}>
                  <strong style={{ color: '#131a24' }}>{alert.ticker}</strong>
                </td>
                <td style={tdStyle}>₹{alert.triggerPrice.toFixed(2)}</td>
                <td style={{ ...tdStyle, color: '#148a9e', fontWeight: 'bold' as const }}>
                  ₹{alert.hitPrice.toFixed(2)}
                </td>
                <td style={tdStyle}>{alert.timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <Hr style={hr} />
        <Text style={footer}>
          You're receiving this because you set price triggers on StockSense.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default PriceTriggerDigestEmail

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
const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  margin: '0 0 20px',
}
const thStyle = {
  textAlign: 'left' as const,
  padding: '8px 12px',
  fontSize: '12px',
  fontWeight: '600' as const,
  color: '#6a6f78',
  borderBottom: '2px solid #e5e7eb',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
}
const tdStyle = {
  padding: '10px 12px',
  fontSize: '14px',
  color: '#6a6f78',
  borderBottom: '1px solid #f3f4f6',
}
const hr = {
  borderColor: '#e5e7eb',
  margin: '20px 0',
}
const footer = { fontSize: '12px', color: '#999999', margin: '0' }
