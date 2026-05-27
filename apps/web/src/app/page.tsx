import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: 16 }}>
        AI Visibility
      </h1>
      <p style={{ fontSize: '1.1rem', lineHeight: 1.6, opacity: 0.8, marginBottom: 32 }}>
        Autonomous SEO remediation. Track A monitors Google Search health.
        Track B benchmars AI visibilty. All fixes go through draft PRs —
        scoped, previewable, and reversible.
      </p>

      <nav style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Link href="/dashboard" style={navStyle}>Dashboard</Link>
        <Link href="/findings" style={navStyle}>Findings</Link>
        <Link href="/handoffs" style={navStyle}>Handoffs</Link>
      </nav>

      <section style={{ marginTop: 48, padding: 24, borderRadius: 12, background: 'rgba(255,255,255,0.05)' }}>
        <h2 style={{ marginTop: 0 }}>Why two tracks?</h2>
        <p style={{ opacity: 0.8 }}>
          <strong>Track A — Google Search Health:</strong> Indexing, PageSpeed,
          metadata, schema, canonical fixes. Proven by GSC data.
        </p>
        <p style={{ opacity: 0.8 }}>
          <strong>Track B — AI Visibility Benchmark:</strong> Prompt packs inspired
          by NorGEO-Bench. Answer snapshots. Competitor tracking. Citation verification.
        </p>
      </section>
    </main>
  );
}

const navStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '12px 24px',
  borderRadius: 8,
  background: '#1a1a1a',
  color: '#fff',
  textDecoration: 'none',
  fontWeight: 500,
};
