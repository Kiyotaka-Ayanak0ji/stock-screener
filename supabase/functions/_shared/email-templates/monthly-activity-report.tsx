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
  Link,
} from 'npm:@react-email/components@0.0.22'

export interface MonthlyActivityReportProps {
  displayName: string
  period: string
  watchlistCount: number
  trackedTickers: number
  favouriteCount: number
  priceTriggerCount: number
  holdingCount: number
  plan: string
  movers: Array<{ ticker: string; price: number; changePercent: number }>
  siteUrl?: string
}

export const MonthlyActivityReportEmail = ({
  displayName,
  period,
  watchlistCount,
  trackedTickers,
  favouriteCount,
  priceTriggerCount,
  holdingCount,
  plan,
  movers,
  siteUrl = 'https://calm-white-cloud.lovable.app',
}: MonthlyActivityReportProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your EquityIQ account activity for {period}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <table style={{ width: '100%' }}>
            <tr>
              <td>
                <Text style={brandText}>
                  Equity<span style={{ color: '#22d3ee' }}>IQ</span>
                </Text>
              </td>
              <td style={{ textAlign: 'right' as const }}>
                <Text style={dateText}>{period}</Text>
              </td>
            </tr>
          </table>
        </Section>

        <Heading style={h1}>Monthly activity report</Heading>
        <Text style={text}>
          Hello {displayName}, here is a summary of your account for {period}.
        </Text>

        <Section style={statsRow}>
          <table style={{ width: '100%' }}>
            <tr>
              <td style={statCell}>
                <Text style={statValue}>{watchlistCount}</Text>
                <Text style={statLabel}>Watchlists</Text>
              </td>
              <td style={statCell}>
                <Text style={statValue}>{trackedTickers}</Text>
                <Text style={statLabel}>Stocks tracked</Text>
              </td>
              <td style={statCell}>
                <Text style={statValue}>{favouriteCount}</Text>
                <Text style={statLabel}>Favourites</Text>
              </td>
            </tr>
            <tr>
              <td style={statCell}>
                <Text style={statValue}>{priceTriggerCount}</Text>
                <Text style={statLabel}>Price alerts set</Text>
              </td>
              <td style={statCell}>
                <Text style={statValue}>{holdingCount}</Text>
                <Text style={statLabel}>Portfolio holdings</Text>
              </td>
              <td style={statCell}>
                <Text style={statValue}>{plan}</Text>
                <Text style={statLabel}>Current plan</Text>
              </td>
            </tr>
          </table>
        </Section>

        {movers.length > 0 && (
          <>
            <Text style={sectionTitle}>Latest close on your tracked stocks</Text>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Stock</th>
                  <th style={{ ...thStyle, textAlign: 'right' as const }}>Price</th>
                  <th style={{ ...thStyle, textAlign: 'right' as const }}>Change</th>
                </tr>
              </thead>
              <tbody>
                {movers.slice(0, 10).map((m, i) => (
                  <tr key={i}>
                    <td style={tdStyle}>
                      <strong style={{ color: '#e2e8f0' }}>{m.ticker}</strong>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' as const }}>
                      ₹{m.price.toFixed(2)}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: 'right' as const,
                        color: m.changePercent >= 0 ? '#4ade80' : '#f87171',
                      }}
                    >
                      {m.changePercent >= 0 ? '+' : ''}
                      {m.changePercent.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <Text style={text}>
          Open your dashboard: <Link href={`${siteUrl}/dashboard`} style={linkStyle}>{siteUrl}/dashboard</Link>
        </Text>

        <Hr style={hr} />
        <Text style={footer}>
          You receive this report because monthly activity reports are enabled on your account.
          Turn them off under Profile, Email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MonthlyActivityReportEmail

const main = { backgroundColor: '#0b1120', fontFamily: 'Helvetica, Arial, sans-serif', margin: 0, padding: '32px 0' }
const container = { backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', margin: '0 auto', maxWidth: '600px', padding: '28px' }
const headerSection = { borderBottom: '1px solid #1e293b', marginBottom: '20px', paddingBottom: '12px' }
const brandText = { color: '#e2e8f0', fontSize: '18px', fontWeight: 'bold' as const, margin: 0 }
const dateText = { color: '#64748b', fontSize: '12px', margin: 0 }
const h1 = { color: '#f1f5f9', fontSize: '22px', fontWeight: 'bold' as const, margin: '0 0 8px' }
const text = { color: '#94a3b8', fontSize: '14px', lineHeight: '22px', margin: '0 0 16px' }
const sectionTitle = { color: '#e2e8f0', fontSize: '14px', fontWeight: 'bold' as const, margin: '20px 0 8px' }
const statsRow = { backgroundColor: '#111c31', border: '1px solid #1e293b', borderRadius: '10px', margin: '0 0 20px', padding: '12px' }
const statCell = { padding: '8px', textAlign: 'center' as const, width: '33%' }
const statValue = { color: '#f1f5f9', fontSize: '18px', fontWeight: 'bold' as const, margin: 0 }
const statLabel = { color: '#64748b', fontSize: '11px', margin: '2px 0 0' }
const tableStyle = { borderCollapse: 'collapse' as const, width: '100%' }
const thStyle = { borderBottom: '1px solid #1e293b', color: '#64748b', fontSize: '11px', padding: '8px 6px', textAlign: 'left' as const, textTransform: 'uppercase' as const }
const tdStyle = { borderBottom: '1px solid #16233b', color: '#cbd5e1', fontSize: '13px', padding: '8px 6px' }
const linkStyle = { color: '#22d3ee' }
const hr = { borderColor: '#1e293b', margin: '24px 0 12px' }
const footer = { color: '#64748b', fontSize: '11px', lineHeight: '18px', margin: 0 }
