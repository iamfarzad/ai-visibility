export default function FindingsPage() {
  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 20px' }}>
      <h1>Findings</h1>
      <p style={{ opacity: 0.6 }}>Detected issues from GSC, PageSpeed, and AI visibility benchmarks.</p>

      <div style={{ marginTop: 24 }}>
        {[
          { id: 1, source: 'GSC', issue: 'Soft 404 on /old-blog-post', severity: 'high', status: 'open' },
          { id: 2, source: 'PSI', issue: 'LCP > 2.5s on homepage', severity: 'medium', status: 'open' },
          { id: 3, source: 'Benchmark', issue: 'Brand absent from "AI consulting Norway"', severity: 'medium', status: 'pending_review' },
        ].map((f) => (
          <div key={f.id} style={{ padding: 16, marginBottom: 12, borderRadius: 8, background: 'rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{f.issue}</strong>
              <span style={{
                padding: '4px 12px',
                borderRadius: 99,
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                background: f.severity === 'high' ? '#ef4444' : f.severity === 'medium' ? '#fbbf24' : '#22c55e',
                color: '#000',
              }}>{f.severity}</span>
            </div>
            <div style={{ opacity: 0.6, marginTop: 8, fontSize: '0.875rem' }}>
              {f.source} · {f.status}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
