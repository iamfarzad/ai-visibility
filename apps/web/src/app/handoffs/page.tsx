export default function HandoffsPage() {
  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 20px' }}>
      <h1>Handoffs</h1>
      <p style={{ opacity: 0.6 }}>Structured fix proposals awaiting approval or execution.</p>

      <div style={{ marginTop: 24 }}>
        {[
          {
            id: 'handoff_001',
            issue: 'Soft 404 on /old-blog-post',
            mode: 'approval_required',
            actions: ['redirect_fix_pr'],
            files: ['next.config.js'],
            risk: 0.42,
          },
        ].map((h) => (
          <div key={h.id} style={{ padding: 20, marginBottom: 16, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{h.issue}</div>
                <div style={{ opacity: 0.6, marginTop: 8, fontSize: '0.875rem' }}>
                  Mode: <strong>{h.mode}</strong> · Risk: <strong>{h.risk}</strong>
                </div>
              </div>
              <span style={{
                padding: '6px 16px',
                borderRadius: 99,
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                background: h.mode === 'auto_safe' ? '#22c55e' : '#fbbf24',
                color: '#000',
              }}>{h.mode === 'auto_safe' ? 'Auto-run' : 'Needs approval'}</span>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: '0.875rem', opacity: 0.7, marginBottom: 8 }}>Proposed fixes:</div>
              {h.actions.map((a) => (
                <span key={a} style={{ display: 'inline-block', padding: '4px 12px', margin: '0 8px 8px 0', borderRadius: 6, background: 'rgba(255,255,255,0.06)', fontSize: '0.8rem' }}>{a}</span>
              ))}
            </div>

            <div style={{ marginTop: 12, fontSize: '0.875rem', opacity: 0.5 }}>
              Files: {h.files.join(', ')}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
