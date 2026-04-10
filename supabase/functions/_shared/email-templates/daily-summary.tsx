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

interface DailySummaryEmailProps {
  displayName: string
  date: string
  gainersCount: number
  losersCount: number
  unchangedCount: number
  avgChange: number
  totalVolume: string
  topGainer?: { ticker: string; changePercent: number; price: number }
  topLoser?: { ticker: string; changePercent: number; price: number }
  stocks: Array<{
    ticker: string
    price: number
    change: number
    changePercent: number
    volume: string
  }>
}

export const DailySummaryEmail = ({
  displayName,
  date,
  gainersCount,
  losersCount,
  unchangedCount,
  avgChange,
  totalVolume,
  topGainer,
  topLoser,
  stocks,
}: DailySummaryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      📊 Your EquityLens daily summary for {date}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header */}
        <Section style={headerSection}>
          <table style={{ width: '100%' }}>
            <tr>
              <td>
                <Text style={brandText}>
                  Equity<span style={{ color: '#22d3ee' }}>Lens</span>
                </Text>
              </td>
              <td style={{ textAlign: 'right' as const }}>
                <Text style={dateText}>{date}</Text>
              </td>
            </tr>
          </table>
        </Section>

        <Heading style={h1}>Daily Summary</Heading>
        <Text style={text}>
          Hey {displayName}, here's how your watchlist performed today:
        </Text>

        {/* Stats Row */}
        <Section style={statsRow}>
          <table style={{ width: '100%' }}>
            <tr>
              <td style={statCell}>
                <Text style={statValue}>{gainersCount}</Text>
                <Text style={{ ...statLabel, color: '#4ade80' }}>Gainers</Text>
              </td>
              <td style={statCell}>
                <Text style={statValue}>{losersCount}</Text>
                <Text style={{ ...statLabel, color: '#f87171' }}>Losers</Text>
              </td>
              <td style={statCell}>
                <Text style={statValue}>{unchangedCount}</Text>
                <Text style={statLabel}>Unchanged</Text>
              </td>
              <td style={statCell}>
                <Text style={{
                  ...statValue,
                  color: avgChange >= 0 ? '#4ade80' : '#f87171',
                }}>
                  {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(2)}%
                </Text>
                <Text style={statLabel}>Avg Change</Text>
              </td>
            </tr>
          </table>
        </Section>

        {/* Top Movers */}
        {(topGainer || topLoser) && (
          <Section style={{ marginBottom: '24px' }}>
            <table style={{ width: '100%' }}>
              <tr>
                {topGainer && (
                  <td style={moverCard}>
                    <Text style={moverLabel}>📈 Top Gainer</Text>
                    <Text style={moverTicker}>{topGainer.ticker}</Text>
                    <Text style={{ ...moverChange, color: '#4ade80' }}>
                      +{topGainer.changePercent.toFixed(2)}%
                    </Text>
                    <Text style={moverPrice}>₹{topGainer.price.toFixed(2)}</Text>
                  </td>
                )}
                {topGainer && topLoser && <td style={{ width: '12px' }} />}
                {topLoser && (
                  <td style={moverCard}>
                    <Text style={moverLabel}>📉 Top Loser</Text>
                    <Text style={moverTicker}>{topLoser.ticker}</Text>
                    <Text style={{ ...moverChange, color: '#f87171' }}>
                      {topLoser.changePercent.toFixed(2)}%
                    </Text>
                    <Text style={moverPrice}>₹{topLoser.price.toFixed(2)}</Text>
                  </td>
                )}
              </tr>
            </table>
          </Section>
        )}

        {/* Stock Table */}
        {stocks.length > 0 && (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Stock</th>
                <th style={{ ...thStyle, textAlign: 'right' as const }}>Price</th>
                <th style={{ ...thStyle, textAlign: 'right' as const }}>Change</th>
                <th style={{ ...thStyle, textAlign: 'right' as const }}>Volume</th>
              </tr>
            </thead>
            <tbody>
              {stocks.slice(0, 15).map((stock, i) => (
                <tr key={i}>
                  <td style={tdStyle}>
                    <strong style={{ color: '#e2e8f0' }}>{stock.ticker}</strong>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' as const, fontFamily: '"JetBrains Mono", monospace' }}>
                    ₹{stock.price.toFixed(2)}
                  </td>
                  <td style={{
                    ...tdStyle,
                    textAlign: 'right' as const,
                    color: stock.changePercent >= 0 ? '#4ade80' : '#f87171',
                    fontWeight: 'bold' as const,
                    fontFamily: '"JetBrains Mono", monospace',
                  }}>
                    {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' as const, color: '#64748b' }}>
                    {stock.volume}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <Hr style={hr} />
        <Text style={footer}>
          You're receiving this daily summary because you're subscribed to
          EquityLens updates. Manage your preferences in your profile settings.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default DailySummaryEmail

const main = {
  backgroundColor: '#0f1419',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
}
const container = {
  padding: '32px 24px',
  maxWidth: '600px',
  margin: '0 auto',
}
const headerSection = { marginBottom: '24px' }
const brandText = {
  fontSize: '18px',
  fontWeight: 'bold' as const,
  color: '#e2e8f0',
  margin: '0',
}
const dateText = {
  fontSize: '12px',
  color: '#64748b',
  margin: '0',
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
const statsRow = {
  backgroundColor: '#1a2332',
  borderRadius: '12px',
  padding: '16px 8px',
  marginBottom: '20px',
  border: '1px solid #1e293b',
}
const statCell = {
  textAlign: 'center' as const,
  padding: '0 4px',
}
const statValue = {
  fontSize: '20px',
  fontWeight: 'bold' as const,
  color: '#e2e8f0',
  margin: '0 0 2px',
  fontFamily: '"JetBrains Mono", monospace',
}
const statLabel = {
  fontSize: '10px',
  fontWeight: '600' as const,
  color: '#64748b',
  margin: '0',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
}
const moverCard = {
  backgroundColor: '#1a2332',
  borderRadius: '12px',
  padding: '14px 16px',
  border: '1px solid #1e293b',
  width: '50%',
}
const moverLabel = {
  fontSize: '11px',
  color: '#64748b',
  margin: '0 0 6px',
}
const moverTicker = {
  fontSize: '16px',
  fontWeight: 'bold' as const,
  color: '#e2e8f0',
  margin: '0 0 2px',
  fontFamily: '"JetBrains Mono", monospace',
}
const moverChange = {
  fontSize: '14px',
  fontWeight: 'bold' as const,
  margin: '0 0 2px',
  fontFamily: '"JetBrains Mono", monospace',
}
const moverPrice = {
  fontSize: '12px',
  color: '#64748b',
  margin: '0',
  fontFamily: '"JetBrains Mono", monospace',
}
const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  marginBottom: '24px',
  backgroundColor: '#1a2332',
  borderRadius: '12px',
  overflow: 'hidden' as const,
}
const thStyle = {
  textAlign: 'left' as const,
  padding: '10px 14px',
  fontSize: '10px',
  fontWeight: '700' as const,
  color: '#64748b',
  borderBottom: '1px solid #1e293b',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
}
const tdStyle = {
  padding: '10px 14px',
  fontSize: '13px',
  color: '#94a3b8',
  borderBottom: '1px solid #1e293b10',
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
